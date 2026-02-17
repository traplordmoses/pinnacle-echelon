// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MemeFutarchy
 * @notice Meme competition with futarchy-style prediction markets on Monad.
 *
 * Flow:
 *   1. Anyone creates a Category (title, stake size, deadlines).
 *   2. Players submit a meme (IPFS hash) + stake MON to enter.
 *   3. During the voting window the crowd:
 *        - distributes up to 5 free votes across memes (batch submit)
 *        - buys prediction shares on ONE meme (1 bet per user per category)
 *   4. After voting ends, anyone can resolve the category.
 *      Winner = highest futarchy score → votes × VOTE_WEIGHT + sharePool × MARKET_WEIGHT
 *   5. Pot distribution:
 *        - Meme creator gets CREATOR_SHARE of the pot
 *        - Prediction-share holders of the winning meme split the rest pro-rata
 */
contract MemeFutarchy {
    // ── Constants ──────────────────────────────────────────────────────
    uint256 public constant VOTE_WEIGHT = 60;
    uint256 public constant MARKET_WEIGHT = 40;
    uint256 public constant CREATOR_SHARE = 20;
    uint256 public constant PROTOCOL_FEE = 5;
    uint256 public constant BASE_SHARE_PRICE = 0.001 ether;
    uint256 public constant PRICE_INCREMENT = 0.0001 ether;
    uint256 public constant MAX_VOTES_PER_USER = 5;

    address public owner;

    // ── Structs ───────────────────────────────────────────────────────
    struct Category {
        uint256 id;
        string title;
        address proposer;
        uint256 stakeAmount;
        uint256 submissionDeadline;
        uint256 votingDeadline;
        uint256 totalPot;
        uint256 memeCount;
        bool resolved;
        uint256 winningMemeId;
    }

    struct Meme {
        uint256 id;
        uint256 categoryId;
        address creator;
        string ipfsHash;
        uint256 voteCount;
        uint256 totalShares;
        uint256 sharePool;
    }

    // ── State ─────────────────────────────────────────────────────────
    uint256 public categoryCount;
    uint256 public memeCount;
    uint256 public protocolBalance;

    mapping(uint256 => Category) public categories;
    mapping(uint256 => Meme) public memes;

    // categoryId => memeId[]
    mapping(uint256 => uint256[]) public categoryMemes;

    // memeId => user => shares
    mapping(uint256 => mapping(address => uint256)) public shares;

    // categoryId => user => total votes used (0 = hasn't voted)
    mapping(uint256 => mapping(address => uint256)) public votesUsed;

    // categoryId => user => has placed a prediction bet
    mapping(uint256 => mapping(address => bool)) public hasBet;

    // categoryId => user => memeId they bet on
    mapping(uint256 => mapping(address => uint256)) public userBetMeme;

    // categoryId => user => submitted
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;

    // ── Events ────────────────────────────────────────────────────────
    event CategoryCreated(uint256 indexed categoryId, string title, address proposer, uint256 stakeAmount, uint256 submissionDeadline, uint256 votingDeadline);
    event MemeSubmitted(uint256 indexed memeId, uint256 indexed categoryId, address creator, string ipfsHash);
    event Voted(uint256 indexed categoryId, uint256 indexed memeId, address voter, uint256 amount);
    event SharesBought(uint256 indexed memeId, address buyer, uint256 amount, uint256 cost);
    event CategoryResolved(uint256 indexed categoryId, uint256 winningMemeId, uint256 winningScore);
    event Claimed(uint256 indexed categoryId, uint256 indexed memeId, address claimer, uint256 payout);
    event ProtocolWithdrawn(address to, uint256 amount);

    // ── Modifiers ─────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── Category ──────────────────────────────────────────────────────

    function createCategory(
        string calldata _title,
        uint256 _stakeAmount,
        uint256 _submissionDeadline,
        uint256 _votingDeadline
    ) external returns (uint256) {
        require(_stakeAmount > 0, "stake must be > 0");
        require(_submissionDeadline > block.timestamp, "submission deadline must be future");
        require(_votingDeadline > _submissionDeadline, "voting must end after submissions");

        categoryCount++;
        categories[categoryCount] = Category({
            id: categoryCount,
            title: _title,
            proposer: msg.sender,
            stakeAmount: _stakeAmount,
            submissionDeadline: _submissionDeadline,
            votingDeadline: _votingDeadline,
            totalPot: 0,
            memeCount: 0,
            resolved: false,
            winningMemeId: 0
        });

        emit CategoryCreated(categoryCount, _title, msg.sender, _stakeAmount, _submissionDeadline, _votingDeadline);
        return categoryCount;
    }

    // ── Meme Submission ───────────────────────────────────────────────

    function submitMeme(uint256 _categoryId, string calldata _ipfsHash) external payable returns (uint256) {
        Category storage cat = categories[_categoryId];
        require(cat.id != 0, "category doesn't exist");
        require(block.timestamp < cat.submissionDeadline, "submissions closed");
        require(msg.value == cat.stakeAmount, "wrong stake amount");
        require(!hasSubmitted[_categoryId][msg.sender], "already submitted");
        require(bytes(_ipfsHash).length > 0, "empty ipfs hash");

        memeCount++;
        memes[memeCount] = Meme({
            id: memeCount,
            categoryId: _categoryId,
            creator: msg.sender,
            ipfsHash: _ipfsHash,
            voteCount: 0,
            totalShares: 0,
            sharePool: 0
        });

        categoryMemes[_categoryId].push(memeCount);
        cat.memeCount++;
        cat.totalPot += msg.value;
        hasSubmitted[_categoryId][msg.sender] = true;

        emit MemeSubmitted(memeCount, _categoryId, msg.sender, _ipfsHash);
        return memeCount;
    }

    // ── Voting (batch, max 5 per user) ────────────────────────────────

    /**
     * @notice Submit votes in a single batch. Each user gets MAX_VOTES_PER_USER
     *         votes to distribute across any memes in the category. Can only be
     *         called once per user per category.
     */
    function vote(
        uint256 _categoryId,
        uint256[] calldata _memeIds,
        uint256[] calldata _voteAmounts
    ) external {
        Category storage cat = categories[_categoryId];
        require(cat.id != 0, "category doesn't exist");
        require(block.timestamp >= cat.submissionDeadline, "voting not open yet");
        require(block.timestamp < cat.votingDeadline, "voting closed");
        require(votesUsed[_categoryId][msg.sender] == 0, "already voted");
        require(_memeIds.length == _voteAmounts.length, "length mismatch");
        require(_memeIds.length > 0, "empty vote");

        uint256 totalVotes = 0;
        for (uint256 i = 0; i < _memeIds.length; i++) {
            require(_voteAmounts[i] > 0, "zero votes");
            Meme storage meme = memes[_memeIds[i]];
            require(meme.categoryId == _categoryId, "meme not in category");
            meme.voteCount += _voteAmounts[i];
            totalVotes += _voteAmounts[i];
            emit Voted(_categoryId, _memeIds[i], msg.sender, _voteAmounts[i]);
        }

        require(totalVotes <= MAX_VOTES_PER_USER, "exceeds max votes");
        votesUsed[_categoryId][msg.sender] = totalVotes;
    }

    // ── Prediction Market (1 bet per user per category) ───────────────

    /**
     * @notice Buy prediction shares on a meme. Price follows a linear bonding curve.
     *         Each user can only bet on ONE meme per category (locked once placed).
     */
    function buyShares(uint256 _memeId, uint256 _amount) external payable {
        require(_amount > 0, "amount must be > 0");
        Meme storage meme = memes[_memeId];
        require(meme.id != 0, "meme doesn't exist");

        Category storage cat = categories[meme.categoryId];
        require(block.timestamp >= cat.submissionDeadline, "market not open yet");
        require(block.timestamp < cat.votingDeadline, "market closed");
        require(!hasBet[meme.categoryId][msg.sender], "already placed a bet");

        uint256 cost = _calculateCost(meme.totalShares, _amount);
        require(msg.value >= cost, "insufficient payment");

        shares[_memeId][msg.sender] += _amount;
        meme.totalShares += _amount;
        meme.sharePool += cost;
        cat.totalPot += cost;

        hasBet[meme.categoryId][msg.sender] = true;
        userBetMeme[meme.categoryId][msg.sender] = _memeId;

        emit SharesBought(_memeId, msg.sender, _amount, cost);

        // refund overpayment (after all state changes + events)
        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            require(ok, "refund failed");
        }
    }

    /**
     * @notice Linear bonding curve cost calculation.
     *         price_i = BASE + i * INCREMENT
     *         Total = amount * BASE + INCREMENT * (amount * current + amount*(amount-1)/2)
     */
    function _calculateCost(uint256 _currentSupply, uint256 _amount) internal pure returns (uint256) {
        uint256 baseCost = _amount * BASE_SHARE_PRICE;
        uint256 incrementCost = PRICE_INCREMENT * (_amount * _currentSupply + (_amount * (_amount - 1)) / 2);
        return baseCost + incrementCost;
    }

    function getShareCost(uint256 _memeId, uint256 _amount) external view returns (uint256) {
        return _calculateCost(memes[_memeId].totalShares, _amount);
    }

    function getSharePrice(uint256 _memeId) external view returns (uint256) {
        return BASE_SHARE_PRICE + memes[_memeId].totalShares * PRICE_INCREMENT;
    }

    // ── Resolution ────────────────────────────────────────────────────

    function resolveCategory(uint256 _categoryId) external {
        Category storage cat = categories[_categoryId];
        require(cat.id != 0, "category doesn't exist");
        require(block.timestamp >= cat.votingDeadline, "voting not over");
        require(!cat.resolved, "already resolved");
        require(cat.memeCount > 0, "no memes submitted");

        uint256[] storage ids = categoryMemes[_categoryId];

        uint256 maxVotes = 0;
        uint256 maxPool = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Meme storage m = memes[ids[i]];
            if (m.voteCount > maxVotes) maxVotes = m.voteCount;
            if (m.sharePool > maxPool) maxPool = m.sharePool;
        }

        uint256 bestScore = 0;
        uint256 bestMemeId = ids[0];
        for (uint256 i = 0; i < ids.length; i++) {
            Meme storage m = memes[ids[i]];
            uint256 normVotes = maxVotes > 0 ? (m.voteCount * 1e18) / maxVotes : 0;
            uint256 normPool = maxPool > 0 ? (m.sharePool * 1e18) / maxPool : 0;
            uint256 score = (normVotes * VOTE_WEIGHT + normPool * MARKET_WEIGHT) / 100;

            if (score > bestScore) {
                bestScore = score;
                bestMemeId = ids[i];
            }
        }

        cat.resolved = true;
        cat.winningMemeId = bestMemeId;

        uint256 fee = (cat.totalPot * PROTOCOL_FEE) / 100;
        protocolBalance += fee;

        emit CategoryResolved(_categoryId, bestMemeId, bestScore);
    }

    // ── Claiming ──────────────────────────────────────────────────────

    function claim(uint256 _categoryId) external {
        Category storage cat = categories[_categoryId];
        require(cat.resolved, "not resolved");

        uint256 winId = cat.winningMemeId;
        Meme storage winner = memes[winId];

        uint256 distributable = cat.totalPot - (cat.totalPot * PROTOCOL_FEE) / 100;
        uint256 payout = 0;

        if (msg.sender == winner.creator) {
            uint256 creatorPayout;
            if (winner.totalShares == 0) {
                // No shareholders exist — creator gets the entire distributable pot
                creatorPayout = distributable;
            } else {
                creatorPayout = (distributable * CREATOR_SHARE) / 100;
            }
            payout += creatorPayout;
            winner.creator = address(0);
        }

        uint256 userShares = shares[winId][msg.sender];
        if (userShares > 0 && winner.totalShares > 0) {
            uint256 shareholderPool = (distributable * (100 - CREATOR_SHARE)) / 100;
            uint256 sharePayout = (shareholderPool * userShares) / winner.totalShares;
            payout += sharePayout;
            shares[winId][msg.sender] = 0;
        }

        require(payout > 0, "nothing to claim");

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");

        emit Claimed(_categoryId, winId, msg.sender, payout);
    }

    // ── Admin ─────────────────────────────────────────────────────────

    function withdrawProtocolFees(address _to) external onlyOwner {
        uint256 amount = protocolBalance;
        require(amount > 0, "no fees");
        protocolBalance = 0;
        (bool ok, ) = _to.call{value: amount}("");
        require(ok, "transfer failed");
        emit ProtocolWithdrawn(_to, amount);
    }

    // ── View Helpers ──────────────────────────────────────────────────

    function getCategoryMemes(uint256 _categoryId) external view returns (uint256[] memory) {
        return categoryMemes[_categoryId];
    }

    function getMemeScore(uint256 _memeId) external view returns (uint256 normVotes, uint256 normPool, uint256 score) {
        Meme storage m = memes[_memeId];
        uint256[] storage ids = categoryMemes[m.categoryId];

        uint256 maxVotes = 0;
        uint256 maxPool = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Meme storage other = memes[ids[i]];
            if (other.voteCount > maxVotes) maxVotes = other.voteCount;
            if (other.sharePool > maxPool) maxPool = other.sharePool;
        }

        normVotes = maxVotes > 0 ? (m.voteCount * 1e18) / maxVotes : 0;
        normPool = maxPool > 0 ? (m.sharePool * 1e18) / maxPool : 0;
        score = (normVotes * VOTE_WEIGHT + normPool * MARKET_WEIGHT) / 100;
    }

    receive() external payable {}
}
