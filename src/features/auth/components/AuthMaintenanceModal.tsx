import { useTranslation } from "react-i18next";
import { Button, Modal } from "@/shared/ui";

interface AuthMaintenanceModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthMaintenanceModal({
  open,
  onClose,
}: AuthMaintenanceModalProps) {
  const { t } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("auth.maintenanceTitle")}
      subtitle={t("auth.maintenance")}
      footer={
        <div className="flex w-full justify-end">
          <Button variant="primary" onClick={onClose}>
            {t("auth.close")}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-white/70">
        {t("auth.maintenanceDescription")}
      </p>
    </Modal>
  );
}
