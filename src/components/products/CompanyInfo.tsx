
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CalendarCheck, MapPin } from 'lucide-react';
import { ProductCompany } from './ProductCard';
import { usePublicCompanyProfile } from '@/application/hooks/usePublicCompanyProfile';
import { getPublicMediaUrl } from '@/application/hooks/usePublicMediaUrl';
import { buildCompanyPath } from '@/domain/config/publicRoutes';

interface CompanyInfoProps {
  company: ProductCompany;
  locationLabel?: string;
  onContact: () => void;
  isLoggedIn: boolean;
  canRequestRental?: boolean;
}

const CompanyInfo = ({ company, locationLabel, onContact, isLoggedIn, canRequestRental = true }: CompanyInfoProps) => {
  const companyProfileQuery = usePublicCompanyProfile(company.slug || null);
  const companyProfile = companyProfileQuery.data ?? null;

  const locationFromProfile = [
    companyProfile?.location.city,
    companyProfile?.location.state,
    companyProfile?.location.country,
  ]
    .filter((item): item is string => Boolean(item && item.trim().length > 0))
    .join(", ");

  const displayLocation = locationFromProfile || locationLabel || null;
  const hasLocation = Boolean(displayLocation && displayLocation.trim().length > 0);
  const companyLogoUrl = getPublicMediaUrl(companyProfile?.profilePictureId, 'THUMBNAIL');
  const companyDescription = companyProfile?.description?.trim() ?? "";
  const companyPath = company.slug ? buildCompanyPath(company.slug) : null;

  return (
    <div className="bg-secondary rounded-lg p-4">
      <h3 className="text-sm font-medium uppercase tracking-wider mb-3">
        Proporcionado por
      </h3>
      <div className="flex items-center">
        <div className="w-12 h-12 overflow-hidden bg-primary/10 text-primary flex items-center justify-center rounded-full mr-3">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={company.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            company.name.charAt(0)
          )}
        </div>
        <div>
          {companyPath ? (
            <Link to={companyPath} className="font-medium hover:text-primary hover:underline">
              {company.name}
            </Link>
          ) : (
            <h4 className="font-medium">{company.name}</h4>
          )}
          {hasLocation && (
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              <MapPin size={14} className="mr-1" />
              <span>{displayLocation}</span>
            </div>
          )}
        </div>
      </div>

      {companyDescription && (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {companyDescription}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Señales de confianza de la empresa">
        <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-lg font-semibold text-foreground">0</p>
          <p className="text-xs text-muted-foreground">valoraciones disponibles</p>
        </div>
        <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2">
          <p className="text-lg font-semibold text-foreground">1+</p>
          <p className="text-xs text-muted-foreground">productos publicados</p>
        </div>
      </div>

      <div className="border-t border-border mt-4 pt-4">
        {companyPath && (
          <Button asChild variant="outline" className="w-full">
            <Link to={companyPath}>Ver empresa</Link>
          </Button>
        )}
        {isLoggedIn && (
          <Button
            className="mt-2 w-full gap-2"
            onClick={onContact}
            disabled={!canRequestRental}
          >
            <CalendarCheck size={16} />
            Solicitar alquiler
          </Button>
        )}
      </div>
    </div>
  );
};

export default CompanyInfo;
