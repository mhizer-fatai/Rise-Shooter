// -----------------------------
// Rise Testnet Wallet + Transaction for page.js
// -----------------------------

const RISE_RPC = "https://testnet.riselabs.xyz";
const CHAIN_ID_DEC = 11155931;
const TARGET_ADDRESS = "0x5abc8a77cb6a174a6991aa62752cc4ad07ac517b";
const PAYMENT_AMOUNT = "0.000001";

let provider, signer, userWallet;
let gameHasStarted = false;

// DOM elements
const connectWalletBtn  = document.getElementById("connect-wallet");
const startGameBtn      = document.getElementById("start-game");
const welcomeScreen     = document.getElementById("welcome-screen");
const gameContainer     = document.getElementById("game-container");
const transactionStatus = document.getElementById("transaction-status");

// -----------------------------
// Wallet connection
// -----------------------------
async function connectWallet() {
  connectWalletBtn.disabled = true;
  transactionStatus.textContent = "Connecting wallet...";
  try {
    if (!window.ethereum) throw new Error("MetaMask not detected");

    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userWallet = await signer.getAddress();

    transactionStatus.textContent = "Wallet connected: " + shortAddr(userWallet);
    connectWalletBtn.textContent = "Wallet Connected ✅";
    connectWalletBtn.disabled = true;

    startGameBtn.style.display = "inline-block";
  } catch (err) {
    console.error(err);
    transactionStatus.textContent = "Wallet connection failed";
    connectWalletBtn.disabled = false;
  }
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// -----------------------------
// Ensure Rise Testnet
// -----------------------------
async function ensureRiseNetwork() {
  const currentChain = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(currentChain, 16) !== CHAIN_ID_DEC) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + CHAIN_ID_DEC.toString(16) }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x" + CHAIN_ID_DEC.toString(16),
            chainName: "Rise Testnet",
            rpcUrls: [RISE_RPC],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: ["https://explorer.testnet.riselabs.xyz"]
          }]
        });
      } else throw switchError;
    }
  }
}

// -----------------------------
// Sign Transaction + Countdown + Start Game
// -----------------------------
async function signTransactionAndStart() {
  if (!signer) { alert("Please connect wallet first"); return; }
  if (gameHasStarted) return;

  try {
    transactionStatus.textContent = "Preparing transaction...";
    await ensureRiseNetwork();

    const tx = await signer.sendTransaction({
      to: TARGET_ADDRESS,
      value: ethers.utils.parseEther(PAYMENT_AMOUNT),
      chainId: CHAIN_ID_DEC
    });

    transactionStatus.textContent = "Transaction signed ✅ Starting soon...";

    // Start countdown AFTER transaction signed
    startCountdown(() => {
      welcomeScreen.style.display = "none";
      gameContainer.style.display = "block";

      if (typeof startGame === "function") {
        startGame();
        gameHasStarted = true;
      } else {
        console.warn("⚠️ startGame() not found in game.js");
      }
    });

    // Confirm transaction in background (non-blocking)
    tx.wait()
      .then(() => console.log("Transaction confirmed:", tx.hash))
      .catch(() => console.warn("Transaction confirmation failed or skipped."));

  } catch (err) {
    console.error(err);
    transactionStatus.textContent = "Transaction failed. Please try again.";
  }
}

// -----------------------------
// Countdown Function
// -----------------------------
function startCountdown(callback) {
  let countdown = 3;
  transactionStatus.textContent = `Game starts in ${countdown}...`;
  const timer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      transactionStatus.textContent = `Game starts in ${countdown}...`;
    } else {
      clearInterval(timer);
      transactionStatus.textContent = "Starting game...";
      callback(); // start the game
    }
  }, 1000);
}

// -----------------------------
// Event listeners
// -----------------------------
connectWalletBtn.addEventListener("click", connectWallet);
startGameBtn.addEventListener("click", signTransactionAndStart);