
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDIMwFfRqgkraB55_aPFZDq-IgOKzDXo0A",
  authDomain: "horaire-marthelinois.firebaseapp.com",
  databaseURL: "https://horaire-marthelinois-default-rtdb.firebaseio.com",
  projectId: "horaire-marthelinois",
  storageBucket: "horaire-marthelinois.firebasestorage.app",
  messagingSenderId: "1040288155989",
  appId: "1:1040288155989:web:066280122eff2662ef47dc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
