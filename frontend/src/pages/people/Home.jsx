import React, { useState, useEffect, useCallback } from "react";
import FeedsCard from "../../components/home/FeedsCard";
import AttendanceCard from "../../components/home/AttendanceCard";
import HolidaysCard from "../../components/home/HolidaysCard";
import ToDoCard from "../../components/home/TodoCard";
import NotesCard from "../../components/home/NotesCard";
import AddCardMenu from "../../components/home/AddCardMenu";
import UpcomingBirthdaysCard from "../../components/home/UpcomingBirthdaysCard";
import LeaveLogCard from "../../components/home/LeaveLogCard";
import TimeoffBalanceCard from "../../components/home/TimeoffBalanceCard";

import { useDispatch, useSelector } from "react-redux";
import {
 fetchCurrentStatus,
 checkInNow,
 checkOutNow
} from "../../slices/attendanceTimer";

import api from "../../axios";
import { toast } from "react-toastify";
import { refreshUserData } from "../../slices/userSlice";
import PageContainer from "../../components/ui/PageContainer";
import Loader from "../../components/ui/Loader";

function format(sec) {
 const h = String(Math.floor(sec / 3600)).padStart(2, "0");
 const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
 const s = String(sec % 60).padStart(2, "0");
 return { h, m, s };
}

const Home = () => {
 const dispatch = useDispatch();
 const { user } = useSelector((state) => state.auth);
 const { userInfo } = useSelector((state) => state.user);
 const { checkInn, loading: reduxLoading } = useSelector((state) => state.attendanceTimer);

 const userId = userInfo?._id || userInfo?.id;

 const [loading, setLoading] = useState(true);
 const [elapsed, setElapsed] = useState(0);
 const [cards, setCards] = useState([]);

 const filterHiddenCards = useCallback(
  (list) =>
  (Array.isArray(list) ? list : []).filter((c) => !["upcomingDeadlines", "tasksAssignedToMe", "recent activities"].includes(c.type)),
  []
 );

 // ✅ NEW: Local Log (same as sidebar)
 const [localLog, setLocalLog] = useState(null);

 const activeLog = localLog || checkInn?.log;

 // Fetch user
 useEffect(() => {
 const userIdToFetch = user?.data?.user?._id || user?.user?._id || user?._id || user?.id;
 if (userIdToFetch) {
 dispatch(refreshUserData(userIdToFetch));
 }
 }, [dispatch, user]);

 // Fetch attendance
 useEffect(() => {
 if (userId) {
 dispatch(fetchCurrentStatus());
 }
 }, [userId, dispatch]);

 // ✅ Verify session (CRITICAL FIX)
 useEffect(() => {
 const verifySession = async () => {
 if (userId) {
 try {
 const { data } = await api.get(`/timetrackers/my/daily/${userId}`);
 if (data?.log) setLocalLog(data.log);
 } catch (e) {
 console.error("Verification failed", e);
 }
 }
 };
 verifySession();
 }, [userId]);

 // Timer
 useEffect(() => {
 let interval;

 if (activeLog?.checkInTime && !activeLog?.checkOutTime) {
 const start = new Date(activeLog.checkInTime).getTime();

 const update = () => {
 const now = Date.now();
 setElapsed(Math.floor((now - start) / 1000));
 };

 update();
 interval = setInterval(update, 1000);
 } else {
 setElapsed(0);
 }

 return () => clearInterval(interval);
 }, [activeLog]);

 const { h, m, s } = format(elapsed);

 // ✅ CheckIn
 const handleCheckIn = () => {
 dispatch(checkInNow())
 .unwrap()
 .then((res) => {
 setLocalLog(res.log);
 toast.success("Checked in");
 })
 .catch(async (err) => {
 toast.error(err?.message);

 if (err?.message?.includes("active")) {
 const { data } = await api.get(`/timetrackers/my/daily/${userId}`);
 if (data?.log) setLocalLog(data.log);
 }
 });
 };

 // ✅ CheckOut
 const handleCheckOut = () => {
 dispatch(checkOutNow())
 .unwrap()
 .then((res) => {
 setLocalLog(res.log);
 toast.success("Checked out");
 })
 .catch(err => toast.error(err?.message));
 };

 // ✅ Button State
 const getButtonState = () => {
 if (!activeLog) {
 return {
 text: "Check In",
 onClick: handleCheckIn,
 className: "bg-emerald-500 hover:bg-emerald-600"
 };
 }

 if (activeLog.checkInTime && !activeLog.checkOutTime) {
 return {
 text: "Check Out",
 onClick: handleCheckOut,
 className: "bg-red-500 hover:bg-red-600"
 };
 }

 return {
 text: "Done",
 className: "bg-slate-400",
 disabled: true
 };
 };

 const buttonState = getButtonState();

 // Dashboard cards
 useEffect(() => {
 const fetchCards = async () => {
 try {
 if (!userId) return;
 setLoading(true);
 const res = await api.get(`/users/${userId}/dashboard-cards`);
 setCards(filterHiddenCards(res.data?.data || res.data || []));
} catch {
  toast.error("Failed to load cards");
  } finally {
  setLoading(false);
  }
  };
  fetchCards();
  }, [userId, filterHiddenCards]);

  const addCard = async (type) => {
    if (cards.some((c) => c.type === type)) {
      toast.info("Card is already added");
      return;
    }
    try {
 const res = await api.post(`/users/${userId}/dashboard-cards/add`, { type });
 setCards(filterHiddenCards(res.data?.data || res.data || []));
    } catch {
      toast.error("Failed");
    }
  };

 const removeCard = async (id) => {
 try {
 await api.delete(`/users/${userId}/dashboard-cards/${id}`);
 setCards(cards.filter(c => c.id !== id));
 } catch {
 toast.error("Failed");
 }
 };
 const profileImage =
 userInfo?.avatar ||
 user?.data?.user?.avatar ||
 user?.user?.avatar ||
 user?.avatar ||
 "https://ui-avatars.com/api/?name=" + (userInfo?.name || user?.data?.user?.name || user?.user?.name || user?.name || "User");

const userName =
 userInfo?.name ||
 user?.data?.user?.name ||
 user?.user?.name ||
 user?.name ||
 "User";
 const renderCard = (card) => {
 const onDelete = () => removeCard(card.id);

 switch (card.type) {
 case "feeds": return <FeedsCard key={card.id} onDelete={onDelete} />;
 case "attendance": return <AttendanceCard key={card.id} onDelete={onDelete} />;
 case "holidays": return <HolidaysCard key={card.id} onDelete={onDelete} />;
 case "todo": return <ToDoCard key={card.id} onDelete={onDelete} userId={userId} />;
 case "notes": return <NotesCard key={card.id} onDelete={onDelete} userId={userId} />;
 case "birthdays": return <UpcomingBirthdaysCard key={card.id} onDelete={onDelete} />;
 case "leavelog": return <LeaveLogCard key={card.id} onDelete={onDelete} />;
 case "timeoffBalance": return <TimeoffBalanceCard key={card.id} onDelete={onDelete} userId={userId} />;
 default: return null;
 }
 };

  if (loading) return <div className="p-6 text-center"><Loader size="lg" text="Loading..." /></div>;

 return (
 <PageContainer
 title={
 <div className="flex items-center gap-3">
 {profileImage ? (
 <img
 src={profileImage}
 alt={userName}
 className="h-11 w-11 rounded-full object-cover border-2 border-white shadow-md"
 />
 ) : (
 <div className="h-11 w-11 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-bold border-2 border-white shadow-md">
 {userName.charAt(0).toUpperCase()}
 </div>
 )}
 <span>Hey, {userInfo?.name || "User"}!</span>
 </div>
 }
 subtitle="Have a great day"
 isCard={false}
 headerActions={
 <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
 <div className="flex items-center gap-1.5">
 <div className="bg-surface border border-border-subtle text-heading px-3 py-2 rounded-xl font-bold text-sm shadow-sm min-w-[2.5rem] text-center">
 {h}
 </div>
 <div className="text-sm font-bold text-heading">:</div>
 <div className="bg-surface border border-border-subtle text-heading px-3 py-2 rounded-xl font-bold text-sm shadow-sm min-w-[2.5rem] text-center">
 {m}
 </div>
 <div className="text-sm font-bold text-heading">:</div>
 <div className="bg-surface border border-border-subtle text-heading px-3 py-2 rounded-xl font-bold text-sm shadow-sm min-w-[2.5rem] text-center">
 {s}
 </div>
 </div>

 <button
 onClick={buttonState.onClick}
 disabled={buttonState.disabled || reduxLoading}
 className={`sm:hidden hide-on-mobile-device text-white text-[10px] font-bold px-3 py-2 rounded-full shadow-md transition-all active:scale-95 ${buttonState.className} disabled:opacity-50`}
 >
 {buttonState.text}
 </button>
 </div>
 }
 >
 <div className="mb-2 text-end">
        <AddCardMenu onAdd={addCard} currentCards={cards} />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
 {cards.map(renderCard)}
 </div>
 </PageContainer>
 );
};

export default Home;