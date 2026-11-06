export interface Labels {
  offer: string; date: string; validUntil: string; total: string;
  nr: string; name: string; qty: string; width: string; height: string; price: string; lineTotal: string;
  profile: string; color: string; glass: string; mechanism: string; shutter: string; net: string; motor: string; note: string;
  shutterYes: string; netYes: string; motorYes: string;
  value: string; discount: string; afterDiscount: string; vat: string; pieces: string;
  issued: string; received: string; notes: string;
}

export const LABELS: Record<"sq" | "en", Labels> = {
  sq: {
    offer: "OFERTA NR:", date: "Data:", validUntil: "Vlen deri:", total: "Totali",
    nr: "Nr", name: "Emertimi", qty: "Sasia", width: "Gjersia", height: "Lartsia", price: "Cmimi", lineTotal: "Totali",
    profile: "Profili:", color: "Ngjyra:", glass: "Xhami:", mechanism: "Mekanizmi:", shutter: "Roleta:",
    net: "Rrjeta per Insekte:", motor: "Motor:", note: "Shenime:",
    shutterYes: "Rolet mbi dritare", netYes: "Rrjeta", motorYes: "Motor",
    value: "Vlera", discount: "Zbritje", afterDiscount: "Vlera-Zbritje", vat: "Tvsh", pieces: "Copë",
    issued: "Faturoi", received: "Pranoi", notes: "Shënime",
  },
  en: {
    offer: "QUOTE NO:", date: "Date:", validUntil: "Valid until:", total: "Total",
    nr: "No", name: "Description", qty: "Qty", width: "Width", height: "Height", price: "Price", lineTotal: "Total",
    profile: "Profile:", color: "Colour:", glass: "Glass:", mechanism: "Hardware:", shutter: "Shutter:",
    net: "Insect screen:", motor: "Motor:", note: "Note:",
    shutterYes: "Roller shutter above window", netYes: "Insect screen", motorYes: "Motor",
    value: "Subtotal", discount: "Discount", afterDiscount: "After discount", vat: "VAT", pieces: "pcs",
    issued: "Issued by", received: "Accepted by", notes: "Notes",
  },
};
