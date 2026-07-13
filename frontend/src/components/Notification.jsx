import { XMarkIcon } from "@heroicons/react/24/solid";
import GlassModal from "./ui/GlassModal";

const NotificationModal = ({ isOpen, onClose }) => {
 if (!isOpen) return null;

 // ✅ Dummy notifications JSON
 const notifications = [
 {
 id: 1,
 title: "New Order",
 message: "You received a new order from Ahmed.",
 time: "2 min ago",
 },
 {
 id: 2,
 title: "Payment Received",
 message: "Your payment of $120 has been received.",
 time: "10 min ago",
 },
 {
 id: 3,
 title: "System Update",
 message: "System maintenance scheduled at midnight.",
 time: "1 hour ago",
 },
 ];

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Notification"
      maxWidth="max-w-md"
    >
      <div className="flex-1 overflow-y-auto space-y-3">
        {notifications.length > 0 ? (
          notifications.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-app rounded-xl text-sm"
            >
              <p className="font-semibold text-main">
                {item.title}
              </p>
              <p className="text-muted">{item.message}</p>
              <span className="text-xs text-muted">
                {item.time}
              </span>
            </div>
          ))
        ) : (
          <div className="p-4 bg-app rounded-xl text-sm text-center text-muted italic">
            No new notifications
          </div>
        )}
      </div>
    </GlassModal>
  );
};

export default NotificationModal;