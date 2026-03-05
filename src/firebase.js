import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCgyMIwZjoB5zOFmtf44TtuXfeXZjuEJE8",
  authDomain: "led-team-warehouse.firebaseapp.com",
  databaseURL: "https://led-team-warehouse-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "led-team-warehouse",
  storageBucket: "led-team-warehouse.firebasestorage.app",
  messagingSenderId: "407951369521",
  appId: "1:407951369521:web:8cac296c5c6db7d3c37c10"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set };
