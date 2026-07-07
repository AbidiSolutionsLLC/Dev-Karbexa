import axios from "axios";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest, msalInstance } from "./authConfig";
import { toast } from "react-toastify"; // Import toast

let store;
function clearAllCookies() {
 const cookies = document.cookie.split(";");

 for (let i = 0; i < cookies.length; i++) {
 const cookie = cookies[i];
 const eqPos = cookie.indexOf("=");
 const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

 // Set expiration date to past to delete the cookie
 document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";

 // Also clear with domain if needed
 document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;

 // Clear for all subdomains
 const domainParts = window.location.hostname.split('.');
 while (domainParts.length > 1) {
 const domain = domainParts.join('.');
 document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + domain;
 domainParts.shift();
 }
 }
}
export const injectStore = (_store) => {
 store = _store;
};



const api = axios.create({
 baseURL: "http://localhost:4000/api/v1",
 timeout: 15000,
 withCredentials: true
});

api.interceptors.request.use(
 async (config) => {
 try {
 const accounts = msalInstance.getAllAccounts();
 const activeAccount = msalInstance.getActiveAccount() || accounts[0];

 if (activeAccount) {
 try {
 const response = await msalInstance.acquireTokenSilent({
 ...loginRequest,
 account: activeAccount
 });
 config.headers.Authorization = `Bearer ${response.idToken}`;
 } catch (error) {
 console.error("Silent token acquisition failed:", error);
 }
 }
 } catch (error) {
 console.error("MSAL initialization error:", error);
 }
 return config;
 },
 (error) => Promise.reject(error)
);

// --- UPDATED RESPONSE INTERCEPTOR ---
api.interceptors.response.use(
 (response) => {
 // Automatically unwrap the backend's ApiResponse wrapper on success
 if (response.data && response.data.success === true && 'data' in response.data) {
   if (response.data.pagination) {
     response.pagination = response.data.pagination;
   }
   response.data = response.data.data;
 }
 return response;
 },
 async (error) => {
 if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('Network Error')) {
   toast.error("Network issue. Request timed out, try again");
   return Promise.reject(error);
 }

 const status = error.response?.status;
 const ignoreAuthRedirect = error.config?.ignoreAuthRedirect;

 if (status === 401 && !ignoreAuthRedirect) {
 console.warn("[AXIOS] 401 Unauthorized — logging out");

 try {
 localStorage.clear();
 sessionStorage.clear();
 clearAllCookies();

 // Clear IndexedDB (safe)
 if (window.indexedDB?.databases) {
 const databases = await window.indexedDB.databases();
 databases.forEach((db) => {
 if (db.name) window.indexedDB.deleteDatabase(db.name);
 });
 }
 } catch (e) {
 console.error("Cleanup failed:", e);
 }

 // Prevent redirect loop
 if (!window.location.pathname.startsWith("/auth/login")) {
 window.location.replace("/auth/login");
 }

 return Promise.reject(error);
 }

 return Promise.reject(error);
 }
);


export default api;
