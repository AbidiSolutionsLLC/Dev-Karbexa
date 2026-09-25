import React, { useEffect, useMemo, useRef, useState } from "react";
import {
 FiTrash2,
 FiPlus,
 FiEdit2,
 FiMoreVertical,
 FiCheckSquare,
} from "react-icons/fi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

import EmptyCardState from "./EmptyCardState";
import ModernDatePicker from "../ui/ModernDatePicker";
import GlassModal from "../ui/GlassModal";
import { formatDateForAPI } from "../../utils/dateUtils";

const EMPTY_FORM = {
 title: "",
 description: "",
 dueDate: "",
};

const formatDateInput = (value) => {
 if (!value) return "";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "";
 return formatDateForAPI(date);
};

const getToday = () => formatDateForAPI(new Date());

const validateTodo = ({ title, description, dueDate }, options = {}) => {
 const { allowPastDue = false } = options;
 const nextErrors = {};
 const titleValue = title.trim();
 const descriptionValue = description.trim();

 if (!titleValue) nextErrors.title = "Task name is required";
 else if (titleValue.length < 3) nextErrors.title = "Task name must be at least 3 characters";
 else if (titleValue.length > 100) nextErrors.title = "Task name cannot exceed 100 characters";

 if (!descriptionValue) nextErrors.description = "Task description is required";
 else if (descriptionValue.length < 3) nextErrors.description = "Task description must be at least 3 characters";
 else if (descriptionValue.length > 500) nextErrors.description = "Task description cannot exceed 500 characters";

 if (!dueDate) nextErrors.dueDate = "Due date is required";
 else if (!allowPastDue && dueDate < getToday()) nextErrors.dueDate = "Due date cannot be in the past";

 return nextErrors;
};

const ToDoCard = ({ onDelete, userId }) => {
 const { user } = useSelector((state) => state.auth);
 const [tasks, setTasks] = useState([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [updatingTaskId, setUpdatingTaskId] = useState(null);
 const [addModalOpen, setAddModalOpen] = useState(false);
 const [addModalForm, setAddModalForm] = useState(EMPTY_FORM);
 const [addModalTouched, setAddModalTouched] = useState({});
 const [menuOpen, setMenuOpen] = useState(false);
 const [modalTouched, setModalTouched] = useState({});
 const [deleteDialog, setDeleteDialog] = useState({ open: false, task: null });
 const [detailModal, setDetailModal] = useState({ open: false, task: null });
 const [modalForm, setModalForm] = useState({ ...EMPTY_FORM, completed: false });
 const menuRef = useRef();
 const pendingDeleteRef = useRef({});

 const resolvedUserId = userId || user?.user?._id || user?.user?.id;
 const addErrors = useMemo(() => validateTodo(addModalForm), [addModalForm]);
 const modalErrors = useMemo(
 () => validateTodo(modalForm, { allowPastDue: true }),
 [modalForm]
 );
 const addDisabled = saving || Object.keys(addErrors).length > 0;
 const modalSaveDisabled =
 Object.keys(modalErrors).length > 0;
 const sortedTasks = useMemo(() => {
 return [...tasks].sort((a, b) => {
 const firstDate = a?.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
 const secondDate = b?.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

 if (firstDate !== secondDate) return firstDate - secondDate;
 return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
 });
 }, [tasks]);

 useEffect(() => {
 const fetchTodos = async () => {
 if (!resolvedUserId) {
 setLoading(false);
 return;
 }

 try {
 setLoading(true);
 const todos = JSON.parse(localStorage.getItem(`todos_${resolvedUserId}`) || '[]');
 setTasks(
 todos.map((todo) => ({
 ...todo,
 dueDate: formatDateInput(todo.dueDate),
 }))
 );
 } catch (error) {
 toast.error(error.response?.data?.message || "Failed to load todos");
 } finally {
 setLoading(false);
 }
 };

 fetchTodos();
 }, [resolvedUserId]);

 useEffect(() => {
 const handleClickOutside = (e) => {
 if (menuRef.current && !menuRef.current.contains(e.target)) {
 setMenuOpen(false);
 }
 };
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

useEffect(() => {
  const pendingDelete = pendingDeleteRef.current;
  return () => {
  Object.values(pendingDelete).forEach(({ timeoutId, task }) => {
 clearTimeout(timeoutId);
 if (resolvedUserId && task?._id) {
 const todos = JSON.parse(localStorage.getItem(`todos_${resolvedUserId}`) || '[]');
 const updatedTodos = todos.filter(t => t._id !== task._id);
 localStorage.setItem(`todos_${resolvedUserId}`, JSON.stringify(updatedTodos));
 }
 });
 };
 }, [resolvedUserId]);

 const resetAddModal = () => {
 setAddModalForm(EMPTY_FORM);
 setAddModalTouched({});
 setAddModalOpen(false);
 };

 const openAddModal = () => {
 setAddModalForm(EMPTY_FORM);
 setAddModalTouched({});
 setAddModalOpen(true);
 };

 const closeAddModal = () => {
 resetAddModal();
 };

 const handleAddFieldChange = (field, value) => {
 setAddModalForm((prev) => ({ ...prev, [field]: value }));
 };

 const handleAddFieldBlur = (field) => {
 setAddModalTouched((prev) => ({ ...prev, [field]: true }));
 };

 const addTask = async () => {
 if (addDisabled || !resolvedUserId) {
 setAddModalTouched({
 title: true,
 description: true,
 dueDate: true,
 });
 return;
 }

 try {
 setSaving(true);
 const payload = {
 title: addModalForm.title.trim(),
 description: addModalForm.description.trim(),
 dueDate: addModalForm.dueDate,
 };
 const newTodo = { _id: Date.now().toString(), ...payload, completed: false, createdAt: new Date().toISOString() };
 const todos = JSON.parse(localStorage.getItem(`todos_${resolvedUserId}`) || '[]');
 todos.push(newTodo);
localStorage.setItem(`todos_${resolvedUserId}`, JSON.stringify(todos));
  setTasks((prev) => [
 {
 ...newTodo,
 dueDate: formatDateInput(newTodo.dueDate),
 },
 ...prev,
 ]);
resetAddModal();
  toast.success("Task added");
  } catch {
  toast.error("Failed to add task");
  } finally {
  setSaving(false);
  }
  };

 const persistTaskUpdate = async (todoId, payload, optimisticUpdater) => {
 const previousTasks = tasks;
 setTasks(optimisticUpdater);

 try {
 setUpdatingTaskId(todoId);
 const todos = JSON.parse(localStorage.getItem(`todos_${resolvedUserId}`) || '[]');
 const index = todos.findIndex(t => t._id === todoId);
 let updatedTodo = payload;
 if (index !== -1) {
todos[index] = { ...todos[index], ...payload };
  updatedTodo = todos[index];
  localStorage.setItem(`todos_${resolvedUserId}`, JSON.stringify(todos));
  }
  setTasks((prev) =>
 prev.map((task) =>
 task._id === todoId
 ? {
 ...task,
 ...updatedTodo,
 dueDate: formatDateInput(updatedTodo.dueDate),
 }
 : task
 )
 );
 return updatedTodo;
 } catch (error) {
 setTasks(previousTasks);
 toast.error(error.response?.data?.message || "Failed to update task");
 throw error;
 } finally {
 setUpdatingTaskId(null);
 }
 };

 const toggleComplete = async (task) => {
 try {
 await persistTaskUpdate(
 task._id,
 { completed: !task.completed },
 (prev) =>
 prev.map((item) =>
 item._id === task._id ? { ...item, completed: !item.completed } : item
 )
 );
 } catch {
 return;
 }
 };

 const undoDelete = (todoId) => {
 const pendingDelete = pendingDeleteRef.current[todoId];
 if (!pendingDelete) return;

 clearTimeout(pendingDelete.timeoutId);
 setTasks((prev) => {
 const next = [...prev];
 next.splice(pendingDelete.index, 0, pendingDelete.task);
 return next;
 });
 delete pendingDeleteRef.current[todoId];
 toast.info("Task restored");
 };

 const confirmDeleteTask = (task) => {
 setDeleteDialog({ open: true, task });
 };

 const closeDetailModal = () => {
 setDetailModal({ open: false, task: null });
 setModalForm({ ...EMPTY_FORM, completed: false });
 setModalTouched({});
 };

 const openDetailModal = (task) => {
 if (!task) return;
 setDetailModal({ open: true, task });
 setModalForm({
 title: task.title || "",
 description: task.description || "",
 dueDate: task.dueDate || "",
 completed: !!task.completed,
 });
 setModalTouched({});
 };

 const handleModalFieldChange = (field, value) => {
 setModalForm((prev) => ({ ...prev, [field]: value }));
 };

 const handleModalFieldBlur = (field) => {
 setModalTouched((prev) => ({ ...prev, [field]: true }));
 };

 const handleModalSave = async () => {
 const task = detailModal.task;
 if (!task?._id || !resolvedUserId) return;
 if (modalSaveDisabled) {
 setModalTouched({ title: true, description: true, dueDate: true, completed: true });
 return;
 }

 try {
 const data = await persistTaskUpdate(
 task._id,
 {
 title: modalForm.title.trim(),
 description: modalForm.description.trim(),
 dueDate: modalForm.dueDate,
 completed: modalForm.completed,
 },
 (prev) =>
 prev.map((t) =>
 t._id === task._id
 ? {
 ...t,
 title: modalForm.title.trim(),
 description: modalForm.description.trim(),
 dueDate: modalForm.dueDate,
 completed: modalForm.completed,
 }
 : t
 )
 );
 const merged = {
 ...task,
 ...data,
 dueDate: formatDateInput(data.dueDate),
 };
 setDetailModal((prev) => ({ ...prev, task: merged }));
 setModalForm({
 title: merged.title || "",
 description: merged.description || "",
 dueDate: merged.dueDate || "",
 completed: !!merged.completed,
 });
 toast.success("Task updated");
 closeDetailModal();
 } catch {
 return;
 }
 };

 const removeTask = () => {
 const task = deleteDialog.task;
 if (!task || !resolvedUserId) return;

 const index = tasks.findIndex((item) => item._id === task._id);
 setTasks((prev) => prev.filter((item) => item._id !== task._id));
 if (detailModal.open && detailModal.task?._id === task._id) {
 closeDetailModal();
 }
 setDeleteDialog({ open: false, task: null });

 const timeoutId = window.setTimeout(async () => {
 try {
 const todos = JSON.parse(localStorage.getItem(`todos_${resolvedUserId}`) || '[]');
 const newTodos = todos.filter(t => t._id !== task._id);
 localStorage.setItem(`todos_${resolvedUserId}`, JSON.stringify(newTodos));
 } catch (error) {
 setTasks((prev) => {
 const next = [...prev];
 next.splice(index, 0, task);
 return next;
 });
 toast.error(error.response?.data?.message || "Failed to delete task");
 } finally {
 delete pendingDeleteRef.current[task._id];
 }
 }, 5000);

 pendingDeleteRef.current[task._id] = { timeoutId, task, index };

 toast(
 ({ closeToast }) => (
 <div className="flex items-center justify-between gap-3 text-xs">
 <span>Task deleted</span>
 <button
 onClick={() => {
 undoDelete(task._id);
 closeToast?.();
 }}
 className="rounded-md bg-slate-900 px-2 py-1 text-white"
 >
 Undo
 </button>
 </div>
 ),
 {
 autoClose: 5000,
 closeOnClick: false,
 }
 );
 };

 return (
 <>
 {/* Inline style for a custom slim scrollbar */}
 <style>{`
 .custom-scrollbar::-webkit-scrollbar {
 width: 4px;
 }
 .custom-scrollbar::-webkit-scrollbar-track {
 background: transparent;
 }
 .custom-scrollbar::-webkit-scrollbar-thumb {
 background: #cbd5e1;
 border-radius: 10px;
 }
 .custom-scrollbar::-webkit-scrollbar-thumb:hover {
 background: #94a3b8;
 }
 `}</style>

 <div className="relative bg-surface rounded-[1.2rem] shadow-md border border-amber-100 p-3 w-full h-full flex flex-col">
 {/* Header - Marked as shrink-0 so it stays fixed at top */}
 <div className="flex justify-between items-start mb-2 shrink-0">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <FiCheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 <h3 className="text-xs font-bold text-main uppercase tracking-tight">To-Do</h3>
 </div>
 <p className="text-[10px] font-medium text-muted">
 Enter your to-do list here
 </p>
 </div>

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

 {/* Add Task Button */}
 <div className="shrink-0 mb-2">
 <button
 onClick={openAddModal}
 className="btn-ghost flex items-center gap-1.5"
 >
 <FiPlus className="h-3.5 w-3.5" />
 Add Task
 </button>
 </div>

 {/* Scrollable Task List Section */}
 <div className="overflow-y-auto flex-1 pr-1 max-h-[150px] custom-scrollbar min-h-0">
 {loading ? (
 <div className="text-[10px] text-muted py-6 text-center">Loading todos...</div>
 ) : sortedTasks.length > 0 ? (
 <ul className="space-y-1.5 text-[10px]">
 {sortedTasks.map((task) => (
 <li
 key={task._id}
 className={`rounded-lg p-2 flex justify-between items-start gap-2 transition-all ${task.completed ? "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100" : "bg-[#E0E5EA]/30 border border-transparent"
 }`}
 >
 <div className="flex items-start gap-2.5 flex-1 min-w-0">
 <input
 type="checkbox"
 checked={task.completed}
 onChange={() => toggleComplete(task)}
 disabled={updatingTaskId === task._id}
 className="mt-0.5 shrink-0 w-4 h-4 cursor-pointer accent-green-600"
 />
 <div className="min-w-0 flex-1">
 <div
 className={`font-semibold cursor-pointer truncate ${task.completed ? "line-through text-muted" : "text-main"
 }`}
 onClick={() => openDetailModal(task)}
 >
 {task.title}
 </div>
 <div
 className="text-[9px] text-muted cursor-pointer whitespace-pre-wrap break-words"
 onClick={() => openDetailModal(task)}
 >
 {task.description}
 </div>
 {task.dueDate && (
 <div
 className="text-[9px] text-muted mt-1 italic cursor-pointer"
 onClick={() => openDetailModal(task)}
 >
 Due: {task.dueDate}
 </div>
 )}
 </div>
 </div>

 <div className="flex flex-col gap-1.5 items-end shrink-0">
 <button
 type="button"
 onClick={() => openDetailModal(task)}
 className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 p-1.5 rounded-md hover:bg-green-200 dark:bg-green-900/50"
 title="View / edit"
 >
 <FiEdit2 className="h-3 w-3" />
 </button>
 <button
 onClick={() => confirmDeleteTask(task)}
 className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 p-1.5 rounded-md hover:bg-red-200 dark:bg-red-900/50"
 >
 <FiTrash2 className="h-3 w-3" />
 </button>
 </div>
 </li>
 ))}
 </ul>
 ) : (
 <EmptyCardState message="You haven't added anything yet" />
 )}
 </div>
 </div>
  {detailModal.open && detailModal.task && (
    <GlassModal
      isOpen={true}
      onClose={closeDetailModal}
      maxWidth="max-w-3xl"
      title={
        <div>
          <h3 className="text-base font-black text-main uppercase tracking-wider">
            Todo
          </h3>
          <p className="text-[11px] text-muted mt-1 font-medium">
            View and update this task
          </p>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 w-full">
          <button
            type="button"
            onClick={closeDetailModal}
            className="btn btn-secondary w-full"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleModalSave}
            disabled={modalSaveDisabled}
            className="w-full sm:w-auto px-8 text-[10px] shadow-slate-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed btn btn-primary"
          >
            {updatingTaskId === detailModal.task._id ? "Saving..." : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">
            Title
          </label>
          <input
            type="text"
            className={`w-full border rounded-xl px-4 py-3 text-sm text-main bg-surface ${
              modalTouched.title && modalErrors.title ? "border-red-400" : "border-subtle"
            }`}
            value={modalForm.title}
            onChange={(e) => handleModalFieldChange("title", e.target.value)}
            onBlur={() => handleModalFieldBlur("title")}
          />
          {modalTouched.title && modalErrors.title && (
            <p className="text-[11px] text-red-500 mt-1.5">{modalErrors.title}</p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">
            Description
          </label>
          <textarea
            rows={8}
            className={`w-full border rounded-xl px-4 py-3 text-sm text-main bg-surface resize-y min-h-[140px] ${
              modalTouched.description && modalErrors.description ? "border-red-400" : "border-subtle"
            }`}
            value={modalForm.description}
            onChange={(e) => handleModalFieldChange("description", e.target.value)}
            onBlur={() => handleModalFieldBlur("description")}
            placeholder="Describe the task..."
          />
          {modalTouched.description && modalErrors.description && (
            <p className="text-[11px] text-red-500 mt-1.5">{modalErrors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <ModernDatePicker
              label="Due Date"
              name="dueDate"
              value={modalForm.dueDate}
              onChange={(e) => handleModalFieldChange("dueDate", e.target.value)}
              required
              placeholder="Select Date"
              error={modalTouched.dueDate && modalErrors.dueDate ? modalErrors.dueDate : null}
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-subtle px-4 py-3 bg-app/80 hover:bg-app transition">
              <input
                type="checkbox"
                checked={modalForm.completed}
                onChange={(e) => handleModalFieldChange("completed", e.target.checked)}
                className="w-4 h-4 rounded accent-green-600"
              />
              <span className="text-sm font-semibold text-main">Mark as completed</span>
            </label>
          </div>
        </div>
      </div>
    </GlassModal>
  )}

  {addModalOpen && (
    <GlassModal
      isOpen={true}
      onClose={closeAddModal}
      maxWidth="max-w-2xl"
      title={
        <div>
          <h3 className="text-base font-black text-main uppercase tracking-wider">
            Add To-Do
          </h3>
          <p className="text-[11px] text-muted mt-1 font-medium">
            Enter task details and save to your to-do list.
          </p>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 w-full">
          <button
            type="button"
            onClick={closeAddModal}
            className="btn btn-secondary w-full"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={addTask}
            disabled={addDisabled}
            className="w-full sm:w-auto px-8 text-[10px] shadow-slate-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed btn btn-primary"
          >
            {saving ? "Saving..." : "Save task"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">
            Title
          </label>
          <input
            type="text"
            className={`w-full border rounded-xl px-4 py-3 text-sm text-main bg-surface ${
              addModalTouched.title && addErrors.title ? "border-red-400" : "border-subtle"
            }`}
            value={addModalForm.title}
            onChange={(e) => handleAddFieldChange("title", e.target.value)}
            onBlur={() => handleAddFieldBlur("title")}
            placeholder="Task name"
          />
          {addModalTouched.title && addErrors.title && (
            <p className="text-[11px] text-red-500 mt-1.5">{addErrors.title}</p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">
            Description
          </label>
          <textarea
            rows={5}
            className={`w-full border rounded-xl px-4 py-3 text-sm text-main bg-surface resize-y min-h-[120px] ${
              addModalTouched.description && addErrors.description ? "border-red-400" : "border-subtle"
            }`}
            value={addModalForm.description}
            onChange={(e) => handleAddFieldChange("description", e.target.value)}
            onBlur={() => handleAddFieldBlur("description")}
            placeholder="Describe the task..."
          />
          {addModalTouched.description && addErrors.description && (
            <p className="text-[11px] text-red-500 mt-1.5">{addErrors.description}</p>
          )}
        </div>

        <div>
          <ModernDatePicker
            label="Due Date"
            name="dueDate"
            value={addModalForm.dueDate}
            onChange={(e) => handleAddFieldChange("dueDate", e.target.value)}
            required
            placeholder="Select Date"
            error={addModalTouched.dueDate && addErrors.dueDate ? addErrors.dueDate : null}
          />
        </div>
      </div>
    </GlassModal>
  )}

  {deleteDialog.open && (
    <GlassModal
      isOpen={true}
      onClose={() => setDeleteDialog({ open: false, task: null })}
      maxWidth="max-w-sm"
      title="Delete Todo"
      footer={
        <div className="flex gap-3 w-full">
          <button
            onClick={() => setDeleteDialog({ open: false, task: null })}
            className="flex-1 py-3 bg-app text-main rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={removeTask}
            className="flex-1 text-[10px] shadow-red-100 btn btn-danger"
          >
            Delete
          </button>
        </div>
      }
    >
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <FiTrash2 className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-xs text-muted font-medium mb-6">
          Are you sure you want to delete this todo? You can undo it for a few seconds after deleting.
        </p>
      </div>
    </GlassModal>
  )}
 </>
 );
};

export default ToDoCard;
