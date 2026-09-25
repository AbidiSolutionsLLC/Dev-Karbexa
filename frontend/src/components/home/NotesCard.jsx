import React, { useState, useRef, useEffect } from "react";
import {
 FiTrash2,
 FiEdit2,
 FiCheck,
 FiMoreVertical,
 FiEdit,
 FiPlus,
} from "react-icons/fi";

import EmptyCardState from "./EmptyCardState";

const NotesCard = ({ onDelete, userId }) => {
 const [notes, setNotes] = useState(() => {
 if (!userId) return [];
 try {
 return JSON.parse(localStorage.getItem(`notes_${userId}`)) || [];
 } catch {
 return [];
 }
 });
 const [newNote, setNewNote] = useState("");
 const [editingId, setEditingId] = useState(null);
 const [editingText, setEditingText] = useState("");
 const [menuOpen, setMenuOpen] = useState(false);
 const menuRef = useRef();

 useEffect(() => {
 const handler = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setMenuOpen(false);
 }
 };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, []);

 useEffect(() => {
 if (userId) {
 localStorage.setItem(`notes_${userId}`, JSON.stringify(notes));
 }
 }, [notes, userId]);

 const addNote = () => {
 if (newNote.trim()) {
 setNotes([...notes, { id: Date.now(), text: newNote.trim() }]);
 setNewNote("");
 }
 };

 const startEditing = (note) => {
 setEditingId(note.id);
 setEditingText(note.text);
 };

 const saveEdit = (id) => {
 setNotes(notes.map((n) => (n.id === id ? { ...n, text: editingText } : n)));
 setEditingId(null);
 setEditingText("");
 };

 const removeNote = (id) => {
 setNotes(notes.filter((note) => note.id !== id));
 };

 return (
 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 w-full h-full flex flex-col">
 {/* Header */}
 <div className="flex justify-between items-start mb-2">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <FiEdit className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">Notes</h3>
 </div>
 <p className="text-[10px] font-medium text-muted">
 Write and edit personal notes
 </p>
 </div>

 {/* 3-dot Menu */}
 <div className="relative" ref={menuRef}>
 <button
 onClick={() => setMenuOpen(!menuOpen)}
 className="p-1.5 rounded-lg hover:bg-app transition"
 >
 <FiMoreVertical className="h-4 w-4 text-muted" />
 </button>

 {menuOpen && (
 <div className="absolute right-0 mt-1 w-32 bg-surface shadow-lg border border-subtle rounded-xl z-50">
 <button
 onClick={() => {
 onDelete();
 setMenuOpen(false);
 }}
 className="flex items-center w-full px-3 py-2 text-[10px] text-red-500 hover:bg-red-50 dark:bg-red-900/30 font-medium"
 >
 <FiTrash2 className="w-3 h-3 mr-2" />
 Delete Card
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Add Note Input */}
 <div className="flex flex-col mb-2 gap-2">
 <input
 type="text"
 className="flex-1 border border-subtle px-3 py-2 rounded-lg text-xs bg-surface"
 placeholder="Write a note..."
 value={newNote}
 onChange={(e) => setNewNote(e.target.value)}
 onKeyDown={(e) => e.key === "Enter" && addNote()}
 />
 <button
 onClick={addNote}
 className="btn btn-secondary flex items-center justify-center gap-1.5"
 >
 <FiPlus className="w-3 h-3" />
 Add
 </button>
 </div>

 {/* Notes List */}
 {notes.length > 0 ? (
 <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[100px] w-full">
 <ul className="space-y-2 text-[10px]">
 {notes.map((note) => (
 <li
 key={note.id}
 className="bg-[#E0E5EA]/30 p-2 rounded-lg flex justify-between items-start gap-2"
 >
 <div className="flex-1">
 {editingId === note.id ? (
 <input
 type="text"
 className="w-full border border-subtle rounded-lg px-2 py-1.5 text-xs bg-surface"
 value={editingText}
 autoFocus
 onChange={(e) => setEditingText(e.target.value)}
 onBlur={() => saveEdit(note.id)}
 onKeyDown={(e) => e.key === "Enter" && saveEdit(note.id)}
 />
 ) : (
 <p
 className="text-main cursor-pointer"
 onClick={() => startEditing(note)}
 >
 {note.text}
 </p>
 )}
 </div>

 <div className="flex gap-1.5 items-end">
 {editingId !== note.id ? (
 <button
 onClick={() => startEditing(note)}
 className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 p-1.5 rounded-md hover:bg-green-200 dark:bg-green-900/50"
 title="Edit"
 >
 <FiEdit2 className="h-3 w-3" />
 </button>
 ) : (
 <button
 onClick={() => saveEdit(note.id)}
 className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:text-amber-400 p-1.5"
 title="Save"
 >
 <FiCheck className="h-3 w-3" />
 </button>
 )}
 <button
 onClick={() => removeNote(note.id)}
 className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 p-1.5 rounded-md hover:bg-red-200 dark:bg-red-900/50"
 title="Delete"
 >
 <FiTrash2 className="h-3 w-3" />
 </button>
 </div>
 </li>
 ))}
 </ul>
 </div>
 ) : (
 <EmptyCardState message="You haven't added anything yet" />
 )}
 </div>
 );
};

export default NotesCard;