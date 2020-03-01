const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();
db = admin.firestore();

async function calcPickPts(currWeek) { //calculates points per pick (50/# women left)
    var pts = 0;
    var numWomen = 0;
    var remWomen = [];

    //query every remaining woman
    let query = db.collection("women").where('week', '==', 100).get()
        .then(snapshot => {
            if (snapshot.empty) {
                console.log('No matching documents.');
                return;
            }
            // loop through each woman
            snapshot.forEach(doc => {
                numWomen++;
                remWomen.push(doc.id)
            });

            pts = 50 / numWomen;
            // call function to calculate all scores per user
            calcUserScores(pts, remWomen, currWeek)

        })
        .catch(err => {
            console.log('Error getting documents', err);
        });
    
}

async function calcUserScores(pts, remWomen, currWeek) { //loop through users and update scores

    // query users
    let query = db.collection("users").get()
        .then(snapshot => {
            
            // error handling
            if (snapshot.empty) {
                console.log('No matching documents.');
                return;
            }

            // loop through each user
            snapshot.forEach(doc => {
                
                var totalCount = 0; // only update user points on last update
                var numCorrect = 0;
                var userName = doc.data().name

                for(var cd in doc.data().picks) { // loops through user picks

                    doc.data().picks[cd].get()
                    .then(childSnapshot => {
                        pickName = childSnapshot.id;
                        
                        // check if pick is in remWomen
                        for(var woman in remWomen){
                            if(remWomen[woman] == pickName){
                                numCorrect = numCorrect + 1; // incr
                            }
                        }
                        totalCount = totalCount + 1;
                        // assign score to user
                        var newScore = numCorrect * pts

                        // update user points in db
                        if (totalCount == doc.data().picks.length) {
                            // call function on last update - async issue
                            updateUserPoints(userName, currWeek, newScore)
                        }
                    });

                }
                    
            })
        })
        .catch(err => {
            console.log('Error getting documents', err);
        });

}

// finds user by userID and updates current score based on week
async function updateUserPoints(userName, currWeek, newScore) {
    
    // querying based on username. Should we query based on id? 
    user = db.collection("users").where('name', '==', userName).get()
        .then(snapshot => {
            if (snapshot.empty) {
                console.log('No matching documents.');
                return;
            }
            //get array
            snapshot.forEach(doc => {
                var ptsRay = doc.data().points
                while (ptsRay.length < currWeek) {
                    ptsRay.push(0);
                }

                ptsRay[currWeek - 1] = newScore

                var total = ptsRay.reduce((a, b) => a + b, 0);

                db.collection("users").doc(doc.id).update({ "points": ptsRay });
                db.collection("users").doc(doc.id).update({ "total": total });

                console.log("Successfully updated " + userName + "'s score!")

            });
        });
}

exports.onScoringUpdate = functions.firestore
    .document('admin/{adminID}')
    .onUpdate((change, context) => {

        // query admin collection
        let week = db.collection('admin').get()
        .then(snapshot => {
            // error handling
            if (snapshot.empty) {
                console.log('No matching documents.');
                return;
            }
            // enter admin info and grab week
            snapshot.forEach(doc => {
                var currWeek = doc.data().week
                calcPickPts(currWeek);
              });

        })
        .catch(err => {
            console.log('Error getting documents', err);
        });
    
        return null
})