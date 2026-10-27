import React from "react";
import { FaPlus } from "react-icons/fa";
import SearchBar from "./SearchBar";
import GlobalTable from "./ui/GlobalTable";
import {
  TableDate,
  TableNumber,
  TableProgress,
  TableStatus,
  TableText,
  TableTitle,
} from "./ui/TableCells";
import { useConfirm } from "../context/ConfirmContext";

const ProjectsTable = ({
  projects,
  loading,
  onUpdate,
  onDelete,
  openModal,
  onRowClick
}) => {
  const confirm = useConfirm();

 const handleEdit = (project) => {
 // You can implement edit functionality here
 // For example, open a modal with the project data
 console.log("Edit project:", project);
 };

 const handleDelete = async (projectId) => {
 await confirm({ 
  title: "Delete Project", 
  message: "Are you sure you want to delete this project?",
  onConfirmAction: async () => {
    await onDelete(projectId);
  }
 });
 };

// Function to decide color based on completion
  const projectColumns = [
  {
  key: "__index",
  label: "S.No.",
  sortable: false,
  type: "index",
  width: 56,
  hideBelow: "sm",
  },
  {
  key: "projectID",
  label: "ID",
  render: (val, project) => <TableText value={val || project._id?.slice(-6).toUpperCase()} muted />
  },
 {
 key: "title",
 label: "Project Name",
 render: (val) => <TableTitle title={val} maxWidth="max-w-[220px]" />
 },
 {
 key: "owner",
 label: "Project Owner",
 render: (val) => <TableText value={val?.name || "N/A"} />
 },
 {
 key: "team",
 label: "No.Of User",
 render: (val) => <TableNumber value={val?.length || 0} />
 },
{
  key: "status",
  label: "Status",
  render: (val) => <TableStatus value={val || "Planning"} />
  },
 {
 key: "startDate",
 label: "Start Date",
 render: (val) => <TableDate value={val} tone="muted" />
 },
 {
 key: "dueDate",
 label: "End Date",
 render: (val) => <TableDate value={val} tone="muted" />
 },
 {
 key: "completion",
 label: "Progress",
 render: (val, project) => { 
    const statusProgressMap = { 'Completed': 100, 'Active': 50, 'In Progress': 50, 'On Hold': 30, 'Planning': 15 }; 
    const progress = val || statusProgressMap[project?.status] || 0; 
    return <TableProgress value={progress} width="min-w-[130px]" />;
 }
 }
 ];

 return (
 <div className="w-full flex flex-col gap-4">
 <GlobalTable
 columns={projectColumns}
 data={projects}
 loading={loading}
 emptyMessage="No projects found"
 defaultSort={{ key: "createdAt", direction: "desc" }}
 onRowClick={onRowClick}
 />
 </div>
 );
};

export default ProjectsTable;
