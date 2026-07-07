import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AssignVisitModal, type AssignVisitFormData } from "@/components/journey/AssignVisitModal";
import { PatientSelectionModal, type Patient } from "@/components/journey/PatientSelectionModal";
import { VisitConfirmationModal } from "@/components/journey/VisitConfirmationModal";
import { VisitAssignedSuccessModal } from "@/components/journey/VisitAssignedSuccessModal";
import { addVisit } from "@/lib/visit-store";
import { NURSES } from "@/lib/mock-data";
type Step = "assign" | "patient" | "confirm" | "success" | null;

export interface AssignedVisit {
    id: string;
    date: string;
    patient: string;
    service: string;
}

interface UseAssignVisitOptions {
    nurseName: string;
    nurseId: string;
}

function generateVisitId() {
    const num = Math.floor(10000 + Math.random() * 90000);
    return `VST-${num}`;
}

export function useAssignVisit({ nurseName, nurseId }: UseAssignVisitOptions) {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>(null);
    const [visitData, setVisitData] = useState<AssignVisitFormData | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [visitId, setVisitId] = useState<string>("");
    const [assignedVisits, setAssignedVisits] = useState<AssignedVisit[]>([]);

    function start() {
        setVisitData(null);
        setPatient(null);
        setStep("assign");
    }

    function close() {
        setStep(null);
    }

    function handleAssignNext(data: AssignVisitFormData) {
        setVisitData(data);
        setStep("patient");
    }

    function handlePatientContinue(p: Patient) {
        setPatient(p);
        setStep("confirm");
    }

    function handleAssign() {
        const id = generateVisitId();
        const nurseCity = NURSES.find(n => n.id === nurseId)?.city ?? "â€”";
        setVisitId(id);

        addVisit({
            id,
            service: visitData!.serviceType,
            date: visitData!.visitDate,
            time: visitData!.visitTime,
            duration: visitData!.duration,
            city: nurseCity, 
            status: "Scheduled",
            nurseId,
            nurseName,
            patientId: patient!.id,
            patientName: patient!.name,
            rating: null,
        });

        setAssignedVisits(prev => [...prev, {
            id,
            date: visitData!.visitDate,
            patient: patient!.name,
            service: visitData!.serviceType,
        }]);
        setStep("success");
        toast.success(`Visit ${id} assigned successfully`);
    }

    function handleViewVisit(id: string) {
        setStep(null);
        navigate({ to: "/visits", params: { visitId: id } });
    }

    const modals = (
        <>
            <AssignVisitModal
                open={step === "assign"}
                nurseName={nurseName}
                onClose={close}
                onNext={handleAssignNext}
            />
            <PatientSelectionModal
                open={step === "patient"}
                onClose={close}
                onBack={() => setStep("assign")}
                onContinue={handlePatientContinue}
            />
            <VisitConfirmationModal
                open={step === "confirm"}
                nurseName={nurseName}
                nurseId={nurseId}
                patient={patient}
                visitData={visitData}
                onClose={close}
                onAssign={handleAssign}
            />
            <VisitAssignedSuccessModal
                open={step === "success"}
                visitId={visitId}
                nurseName={nurseName}
                patient={patient}
                onViewVisit={handleViewVisit}
                onClose={close}
            />
        </>
    );

    return { start, modals, assignedVisits };
}
