const fs = require('fs');
const path = require('path');

// File paths
const fingerprint1Path = path.join(__dirname, '..', 'biometrics', 'fingerprint1.json');
const fingerprint2Path = path.join(__dirname, '..', 'biometrics', 'fingerprint2.json');

// Read JSON files
const fingerprint1 = JSON.parse(fs.readFileSync(fingerprint1Path));
const fingerprint2 = JSON.parse(fs.readFileSync(fingerprint2Path));


// Helper function to calculate Euclidean distance
function euclideanDistance(point1, point2) {
    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
}

// Basic matching function
function matchFingerprints(stored, newFingerprint, threshold = 5) {
    let matches = 0;

    for (let i = 0; i < stored.minutiae_points.length; i++) {
        for (let j = 0; j < newFingerprint.minutiae_points.length; j++) {
            const storedPoint = stored.minutiae_points[i];
            const newPoint = newFingerprint.minutiae_points[j];

            if (storedPoint.type === newPoint.type && Math.abs(storedPoint.orientation - newPoint.orientation) <= 10) {
                const distance = euclideanDistance(storedPoint, newPoint);
                if (distance <= threshold) {
                    matches++;
                    break;  // Move to the next stored point after a match
                }
            }
        }
    }

    // Define a threshold for a match (e.g., 70% of points should match)
    const matchThreshold = 0.7 * stored.minutiae_points.length;
    return matches >= matchThreshold;
}


module.exports = {
    matchFingerprints,
};
