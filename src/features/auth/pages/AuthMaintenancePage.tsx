import { useNavigate } from "react-router-dom";
import AuthMaintenanceModal from "@/features/auth/components/AuthMaintenanceModal";

export default function AuthMaintenancePage() {
  const navigate = useNavigate();

  return (
    <AuthMaintenanceModal
      open
      onClose={() => navigate("/dashboard", { replace: true })}
    />
  );
}
