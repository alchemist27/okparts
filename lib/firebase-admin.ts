// Server-side Firebase (lazy initialization)
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let app: any = null;
let _db: any = null;
let _storage: any = null;

function getApp() {
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
  }
  return app;
}

export const db = new Proxy({} as any, {
  get(_target, prop) {
    if (!_db) {
      _db = getFirestore(getApp());
    }
    return _db[prop];
  },
});

export const storage = new Proxy({} as any, {
  get(_target, prop) {
    if (!_storage) {
      _storage = getStorage(getApp());
    }
    return _storage[prop];
  },
});
