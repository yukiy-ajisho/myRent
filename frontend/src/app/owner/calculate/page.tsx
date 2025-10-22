"use client";

import { useState } from "react";
import { useProperty, Property } from "@/contexts/PropertyContext";
import CalculateModal from "../../../components/CalculateModal";
import DivisionMethodsModal from "../../../components/DivisionMethodsModal";
import RentManagerModal from "../../../components/RentManagerModal";
import StayManagerModal from "../../../components/StayManagerModal";

export default function Calculate() {
  const { userProperties } = useProperty();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<
    "division" | "rent" | "stay" | "calculate" | null
  >(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );

  const openModal = (
    type: "division" | "rent" | "stay" | "calculate",
    property: Property
  ) => {
    setSelectedProperty(property);
    setModalType(type);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    setSelectedProperty(null);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Calculate</h1>
      </div>

      {/* Properties List */}
      <div className="space-y-6">
        {userProperties.map((property) => (
          <div
            key={property.property_id}
            className="bg-white border border-gray-200 rounded-lg p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {property.name}
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openModal("division", property)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                >
                  Division
                </button>
                <button
                  onClick={() => openModal("rent", property)}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
                >
                  Rent
                </button>
                <button
                  onClick={() => openModal("stay", property)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm"
                >
                  Stay
                </button>
                <button
                  onClick={() => openModal("calculate", property)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 text-sm"
                >
                  Calculate
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {isModalOpen && selectedProperty && (
        <>
          {modalType === "calculate" && (
            <CalculateModal
              property={selectedProperty}
              isOpen={isModalOpen}
              onClose={closeModal}
            />
          )}
          {modalType === "division" && (
            <DivisionMethodsModal
              property={selectedProperty}
              isOpen={isModalOpen}
              onClose={closeModal}
            />
          )}
          {modalType === "rent" && (
            <RentManagerModal
              property={selectedProperty}
              isOpen={isModalOpen}
              onClose={closeModal}
            />
          )}
          {modalType === "stay" && (
            <StayManagerModal
              property={selectedProperty}
              isOpen={isModalOpen}
              onClose={closeModal}
            />
          )}
        </>
      )}
    </div>
  );
}
