
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { toast } from "sonner";

// Import steps
import CompanyInfoStep from './steps/CompanyInfoStep';
import ContactInfoStep from './steps/ContactInfoStep';
import SelectPlanStep from './steps/SelectPlanStep';
import { useCreateCompanyUpgradeCheckoutSession } from "@/application/hooks/useBilling";
import type { CompanyBillingPlanType } from "@/domain/models/Billing";
import {
  buildBillingBaseUrl,
  buildBillingCheckoutSuccessUrl,
} from "@/hooks/useBillingReturnSync";
import { extractBackendErrorMessage } from "@/utils/backendError";

// Form schema
const companyFormSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  fiscalId: z.string().min(5),
  slug: z.string().min(3),
  street: z.string().min(2),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
  postalCode: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  contactEmail: z.string().email(),
  contactPhoneCountryCode: z.string().min(2),
  contactPhonePrefix: z.string().min(2),
  contactPhoneNumber: z.string().min(6),
  selectedPlan: z.enum(['starter', 'pro', 'enterprise', 'early_bird'])
});

export type CompanyFormData = z.infer<typeof companyFormSchema>;

type Step = 'info' | 'contact' | 'plan';

const UpgradePage = () => {
  const navigate = useNavigate();
  const createCheckoutMutation = useCreateCompanyUpgradeCheckoutSession();
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    description: '',
    fiscalId: '',
    slug: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    latitude: undefined,
    longitude: undefined,
    contactEmail: '',
    contactPhoneCountryCode: 'ES',
    contactPhonePrefix: '+34',
    contactPhoneNumber: '',
    selectedPlan: 'starter'
  });

  const handleUpdateFormData = (data: Partial<CompanyFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleNext = (step: Step) => {
    setCurrentStep(step);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const companySettingsUrl = buildBillingBaseUrl(
        `${window.location.origin}/dashboard/config`
      );
      const selectedPlan = formData.selectedPlan as CompanyBillingPlanType;
      const checkoutSession = await createCheckoutMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        fiscalIdentifier: formData.fiscalId,
        contactEmail: formData.contactEmail,
        phoneNumber: {
          countryCode: formData.contactPhoneCountryCode.trim(),
          prefix: formData.contactPhonePrefix.trim(),
          number: formData.contactPhoneNumber.trim()
        },
        address: {
          street: formData.street.trim(),
          street2: formData.street2?.trim() || null,
          city: formData.city.trim(),
          postalCode: formData.postalCode.trim(),
          state: formData.state.trim(),
          country: formData.country.trim()
        },
        location:
          typeof formData.latitude === 'number' && typeof formData.longitude === 'number'
            ? {
                latitude: formData.latitude,
                longitude: formData.longitude,
              }
            : null,
        planType: selectedPlan,
        successUrl: buildBillingCheckoutSuccessUrl(
          companySettingsUrl,
          "company",
          selectedPlan
        ),
        cancelUrl: `${window.location.origin}/dashboard/upgrade`,
      });

      window.location.assign(checkoutSession.url);
    } catch (error) {
      console.error('Error upgrading to company:', error);
      const backendError = extractBackendErrorMessage(error);
      toast.error(
          backendError ?? "No se pudo iniciar el checkout de Stripe para la empresa."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'contact') {
      setCurrentStep('info');
    } else if (currentStep === 'plan') {
      setCurrentStep('contact');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Actualizar a Cuenta de Empresa</h1>
          <p className="text-muted-foreground">
            Completa la información necesaria para convertir tu cuenta en una cuenta de empresa.
          </p>
        </div>

        <div className="w-full">
          <div className="mb-2 grid grid-cols-3 gap-3 px-1 text-left text-xs sm:text-sm">
            <div className={`font-medium ${currentStep === 'info' ? 'text-primary' : ''}`}>
              Información
            </div>
            <div className={`font-medium ${currentStep === 'contact' ? 'text-primary' : ''}`}>
              Contacto
            </div>
            <div className={`font-medium ${currentStep === 'plan' ? 'text-primary' : ''}`}>
              Plan
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all"
              style={{
                width: currentStep === 'info'
                  ? '33.3%'
                  : currentStep === 'contact'
                    ? '66.6%'
                    : '100%'
              }}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          {currentStep === 'info' && (
            <CompanyInfoStep 
              formData={formData} 
              onUpdateFormData={handleUpdateFormData} 
              onNext={() => handleNext('contact')}
              onBack={handleBack}
            />
          )}

          {currentStep === 'contact' && (
            <ContactInfoStep 
              formData={formData} 
              onUpdateFormData={handleUpdateFormData} 
              onNext={() => handleNext('plan')}
              onBack={handleBack}
            />
          )}

          {currentStep === 'plan' && (
            <SelectPlanStep 
              formData={formData} 
              onUpdateFormData={handleUpdateFormData} 
              onComplete={handleComplete}
              onBack={handleBack}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradePage;
