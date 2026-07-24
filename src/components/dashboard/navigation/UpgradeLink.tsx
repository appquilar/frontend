
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Componente para el enlace de actualización a cuenta de empresa
 */
interface UpgradeLinkProps {
  onAfterNavigate?: () => void;
}

const UpgradeLink = ({ onAfterNavigate }: UpgradeLinkProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    onAfterNavigate?.();
    navigate('/dashboard/upgrade');
  };

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left transition-colors hover:bg-orange-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-orange-600">Hazte empresa</p>
          <p className="text-xs text-zinc-600">
            Completa la configuración de empresa para alquilar como tienda.
          </p>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-orange-500" />
      </div>
    </button>
  );
};

export default UpgradeLink;
