const hre = require("hardhat");

async function main() {
  const MemeFutarchy = await hre.ethers.getContractFactory("MemeFutarchy");
  const memeFutarchy = await MemeFutarchy.deploy();
  await memeFutarchy.waitForDeployment();

  const address = await memeFutarchy.getAddress();
  console.log("MemeFutarchy deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
