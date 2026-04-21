const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, increment, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBn8BfhPEKSTroJiJL-zK-9hLfyfTcVzMI",
  authDomain: "arts-920d8.firebaseapp.com",
  projectId: "arts-920d8",
  storageBucket: "arts-920d8.firebasestorage.app",
  messagingSenderId: "703560838714",
  appId: "1:703560838714:web:dcfe6361c4b192b3b8cf03"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function runInjection(email, password, amount) {
  try {
    console.log(`Logging in as ${email}...`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    console.log(`Login successful. User UID: ${uid}`);

    console.log(`Adding ${amount} to balance...`);
    
    // Update balance
    await updateDoc(doc(db, "users", uid), {
      balance: increment(amount)
    });

    // Add transaction record
    await addDoc(collection(db, "users", uid, "transactions"), {
      type: 'credit',
      description: 'Test Credit (Requested)',
      amount: amount,
      category: 'misc',
      status: 'success',
      createdAt: serverTimestamp()
    });

    console.log(`✅ Successfully added ${amount} to ${email}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Action failed:", err.message);
    process.exit(1);
  }
}

runInjection("foodtest@test.com", "foodtest@test.com", 200);
