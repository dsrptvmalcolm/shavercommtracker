/** One vehicle as read from the VinCue Facebook export. */
export type FeedVehicle = {
  vin: string;
  stockNumber: string;
  year: number | null;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  drivetrain: string;
  transmission: string;
  fuelType: string;
  mileage: number | null;
  price: number | null;
  exteriorColor: string;
  interiorColor: string;
  url: string;
  images: string[];
  descriptionHtml: string;
  dealerName: string;
  dealerAddress: string;
  /** YYYY-MM-DD */
  dateFirstOnLot: string | null;
};

export type FeedRejection = { line: number; reason: string };
