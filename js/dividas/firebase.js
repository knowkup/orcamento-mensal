// Bridges debt modules to Orçamento's already-initialized Firebase instance.
// All debt data is stored under users/{uid}/ subcollections.
import { state as appState } from '../state.js';

const sdk = () => appState.firestore;
const _db = () => appState.db;
const uid = () => "qrWV1A6gLsXDUojTMUCyIJaMqgI2";

// User-scoped collection helpers
export const debtsColl = () => sdk().collection(_db(), `users/${uid()}/debts`);
export const debtDoc = (id) => sdk().doc(_db(), `users/${uid()}/debts/${id}`);
export const installmentsColl = () => sdk().collection(_db(), `users/${uid()}/debtInstallments`);
export const installmentDoc = (id) => sdk().doc(_db(), `users/${uid()}/debtInstallments/${id}`);
export const paymentsColl = () => sdk().collection(_db(), `users/${uid()}/debtPayments`);
export const paymentDoc = (id) => sdk().doc(_db(), `users/${uid()}/debtPayments/${id}`);
export const debtCreditorsColl = () => sdk().collection(_db(), `users/${uid()}/debtCreditors`);
export const debtCreditorDoc = (id) => sdk().doc(_db(), `users/${uid()}/debtCreditors/${id}`);
export const renegotiationsColl = () => sdk().collection(_db(), `users/${uid()}/debtRenegotiations`);

// SDK function wrappers — delegate to appState.firestore
export const addDoc = (coll, data) => sdk().addDoc(coll, data);
export const getDocs = (q) => sdk().getDocs(q);
export const updateDoc = (ref, data) => sdk().updateDoc(ref, data);
export const deleteDoc = (ref) => sdk().deleteDoc(ref);
export const query = (...args) => sdk().query(...args);
export const where = (...args) => sdk().where(...args);
export const writeBatch = () => sdk().writeBatch(_db());
export const serverTimestamp = () => sdk().serverTimestamp();
// Generic doc/collection for cases like doc(collRef) → auto-ID ref
export const doc = (...args) => sdk().doc(...args);
export const collection = (...args) => sdk().collection(...args);
