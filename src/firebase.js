import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {

  authDomain: "horaire-marthelinois.firebaseapp.com",

  databaseURL: "https://horaire-marthelinois-default-rtdb.firebaseio.com",

  projectId: "horaire-marthelinois",

  storageBucket: "horaire-marthelinois.firebasestorage.app",

  messagingSenderId: "1040288155989",

  appId: "1:1040288155989:web:a53015946b9f0210ef47dc"

};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Exporter la base de données Firestore
export const db = getFirestore(app);
