let currentLevel = 1;
let nextLevelTimeout = null;

// Called every frame from game.js update()
function checkLevelProgress(score, levelThresholds, onLevelComplete, onLevelStart) {
    if (currentLevel <= levelThresholds.length && score >= levelThresholds[currentLevel - 1]) {
        // Level complete
        onLevelComplete(currentLevel);
        startNextLevelCountdown(currentLevel + 1, onLevelStart);
        return true; // Pause game during level transition
    }
    return false;
}

// Shows the level complete message and countdown, then calls onLevelStart
function startNextLevelCountdown(nextLevel, onLevelStart) {
    let countdown = 5;
    showLevelMessage(
      `<strong>Level ${currentLevel} Complete!</strong><br>Level ${nextLevel} starting in <span id="countdown">${countdown}</span> seconds`
    );

    nextLevelTimeout = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            showLevelMessage(
              `<strong>Level ${currentLevel} Complete!</strong><br>Level ${nextLevel} starting in <span id="countdown">${countdown}</span> seconds`
            );
        } else {
            clearInterval(nextLevelTimeout);
            showLevelMessage('');
            currentLevel = nextLevel;
            onLevelStart(currentLevel);
        }
    }, 2000); // 2 seconds per countdown step (slower)
}

// Shows or hides the level transition message
function showLevelMessage(message) {
    let msgElem = document.getElementById('level-message');
    if (!msgElem) return;
    msgElem.innerHTML = message;
    msgElem.style.display = message ? 'block' : 'none';
}

// Returns the current level number (for use in game.js)
function getCurrentLevel() {
    return currentLevel;
}