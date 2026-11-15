/* Demo accounts created by `npm run db:seed`. Local demo data only. */
export const DEMO_PASSWORD = "PetJet-demo-2026";

export const DEMO_ACCOUNTS = {
  owner: { email: "mariyam@petjet.test", name: "Mariyam Khan", role: "OWNER" },
  vet: {
    email: "vet@petjet.test",
    name: "Dr Asha Patel",
    role: "VET",
    provider: {
      type: "VET",
      name: "Riverside Veterinary Centre",
      registrationNumber: "RCVS-DEMO-7041",
      city: "London",
      postcode: "SE1 7PB",
      officialVet: true,
      services: JSON.stringify([
        "MICROCHIP",
        "RABIES_VACCINATION",
        "RABIES_BOOSTER",
        "ANIMAL_HEALTH_CERTIFICATE",
        "TAPEWORM_TREATMENT",
      ]),
      blurb: "Official vets for pet travel paperwork, open six days a week near London Bridge.",
    },
  },
  lab: {
    email: "lab@petjet.test",
    name: "Northgate Pathology",
    role: "LAB",
    provider: {
      type: "LAB",
      name: "Northgate Pathology Laboratory",
      registrationNumber: "UKAS-DEMO-2210",
      city: "Manchester",
      postcode: "M4 5JD",
      services: JSON.stringify(["RABIES_TITRE", "HEALTH_SCREEN"]),
      blurb: "Rabies antibody titre testing and pre-travel health screens.",
    },
  },
} as const;

/**
 * Extra practices for the vet directory. They have no login (the password hash is not a
 * valid bcrypt hash), so they exist only to make the directory realistic.
 */
export const DIRECTORY_VETS = [
  {
    email: "camden-vets@petjet.test",
    name: "Camden Animal Clinic",
    provider: {
      type: "VET",
      name: "Camden Animal Clinic",
      registrationNumber: "RCVS-DEMO-3318",
      city: "London",
      postcode: "NW1 8QL",
      officialVet: false,
      services: JSON.stringify(["MICROCHIP", "RABIES_VACCINATION", "RABIES_BOOSTER", "TAPEWORM_TREATMENT"]),
      blurb: "Friendly first-opinion practice. Vaccinations and microchips, no travel certificates.",
    },
  },
  {
    email: "greenwich-pet-health@petjet.test",
    name: "Greenwich Pet Health",
    provider: {
      type: "VET",
      name: "Greenwich Pet Health",
      registrationNumber: "RCVS-DEMO-5527",
      city: "London",
      postcode: "SE10 9HT",
      officialVet: true,
      services: JSON.stringify([
        "MICROCHIP",
        "RABIES_VACCINATION",
        "RABIES_BOOSTER",
        "ANIMAL_HEALTH_CERTIFICATE",
        "TAPEWORM_TREATMENT",
      ]),
      blurb: "Two official vets on site. Same-week travel certificate appointments.",
    },
  },
  {
    email: "islington-vets@petjet.test",
    name: "Islington Veterinary Surgery",
    provider: {
      type: "VET",
      name: "Islington Veterinary Surgery",
      registrationNumber: "RCVS-DEMO-6602",
      city: "London",
      postcode: "N1 2XF",
      officialVet: true,
      services: JSON.stringify(["ANIMAL_HEALTH_CERTIFICATE", "TAPEWORM_TREATMENT", "RABIES_BOOSTER"]),
      blurb: "Travel-focused practice for certificates and pre-flight treatments.",
    },
  },
] as const;
