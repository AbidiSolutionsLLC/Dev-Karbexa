import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useMsal } from "@azure/msal-react";
import { logout } from "../slices/authSlice";

import NavbarVertical from "../components/NavbarVertical";
import SubNavbarVertical from "../components/SubNavbarVertical";
import RightSidebar from "../components/RightSidebar";
import {
 Bars3Icon,
 XMarkIcon
} from "@heroicons/react/24/solid";
import NotificationModal from "../components/Notification";

const AppLayout = () => {
 const [isRightBarOpen, setRightBarOpen] = useState(true);
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const [isNotificationOpen, setIsNotificationOpen] = useState(false);
 const settingsRef = useRef(null);
 const location = useLocation();

 // --- THE FIX IS HERE ---
 const isPeoplePortal = ["/people", "/leave", "/file", "/faq"].some(path =>
 location.pathname.startsWith(path)
 );
 // -----------------------

 const dispatch = useDispatch();
 const { instance } = useMsal();

 useEffect(() => {
 setIsMobileMenuOpen(false);
 }, [location.pathname]);

 useEffect(() => {
 function handleClickOutside(event) {
 if (settingsRef.current && !settingsRef.current.contains(event.target)) {
 // Close logic if needed
 }
 }
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 const handleLogout = () => {
 dispatch(logout());
 instance.logoutRedirect({
 postLogoutRedirectUri: window.location.origin,
 }).catch(e => {
 console.error("Logout error:", e);
 });
 };

 return (
 <div className="flex flex-col h-screen w-full bg-transparent font-sans overflow-hidden text-main">
 <NotificationModal isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
 {/* --- MOBILE HEADER --- */}
 <div className="md:hidden flex items-center justify-between px-4 py-3 bg-transparent z-50 shrink-0">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-md theme-brand-badge">
 A
 </div>
 <span className="text-sm font-bold tracking-tight uppercase theme-mobile-label">
 Abidi Pro
 </span>
 </div>
 <button
 onClick={() => setIsMobileMenuOpen(true)}
 className="p-2 rounded-lg shadow-sm theme-bell-default"
 >
 <Bars3Icon className="h-6 w-6" />
 </button>
 </div>

 {/* --- MAIN LAYOUT CONTAINER --- */}
 <div className="flex flex-1 w-full h-full relative overflow-hidden">

 {/* --- MOBILE OVERLAY --- */}
 {isMobileMenuOpen && (
 <div
 className="fixed inset-0 bg-app z-[60] md:hidden "
 onClick={() => setIsMobileMenuOpen(false)}
 />
 )}

 {/* --- LEFT SIDEBAR --- */}
 <aside className={`
 absolute inset-y-0 left-0 z-[70] h-full pl-2 py-2 flex transition-transform duration-300 ease-in-out
 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
 md:relative md:translate-x-0 md:flex md:h-full md:py-4 md:pl-4
 `}>
 <div className="flex items-stretch h-full gap-0 relative">

 <button
 onClick={() => setIsMobileMenuOpen(false)}
 className="md:hidden absolute -right-10 top-2 p-2 bg-surface text-main rounded-full shadow-lg"
 >
 <XMarkIcon className="h-5 w-5" />
 </button>

 {/* NavbarVertical */}
 <div className="flex items-center h-full">
 <NavbarVertical onNotificationClick={() => setIsNotificationOpen(true)} />
 </div>

 {/* SubNavbarVertical */}
 <div className="flex items-center h-full">
 <SubNavbarVertical />
 </div>
 </div>
 </aside>

 {/* --- MAIN CONTENT AREA --- */}
 <main className="flex-1 m-2 md:m-4 md:ml-2 md:mr-2 rounded-[1.5rem] md:rounded-[2rem] bg-surface dark:bg-app -[60px] shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/60 dark:border-white/10 text-main relative transition-all duration-500 ease-in-out overflow-hidden flex flex-col">
 <div className="flex-1 p-3 md:p-4 overflow-y-auto scrollbar-on-hover">
 <Outlet />
 </div>
 </main>

 {/* --- RIGHT SIDEBAR --- */}
 {isPeoplePortal && (
 <div className="hidden md:flex flex-col h-full py-2 md:py-4 pr-2 md:pr-3">
 <RightSidebar
 isOpen={isRightBarOpen}
 toggleSidebar={() => setRightBarOpen(!isRightBarOpen)}
 />
 </div>
 )}
 </div>
 </div>
 );
};

export default AppLayout; 