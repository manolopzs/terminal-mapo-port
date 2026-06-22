/**
 * Curated stock universe for discovery fallback when FMP screener is unavailable.
 * Mid-cap focus ($500M–$50B), AGI/growth thesis aligned, excludes mega-caps.
 */

export interface UniverseStock {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number; // approximate, in USD
}

export const STOCK_UNIVERSE: UniverseStock[] = [
  // ── Technology ────────────────────────────────────────────────────────────
  { ticker: "PLTR",  companyName: "Palantir Technologies",      sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 45_000_000_000 },
  { ticker: "APP",   companyName: "AppLovin Corp",               sector: "Technology",              industry: "Software—Application",           marketCap: 40_000_000_000 },
  { ticker: "CRWD",  companyName: "CrowdStrike Holdings",        sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 38_000_000_000 },
  { ticker: "NET",   companyName: "Cloudflare Inc",              sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 18_000_000_000 },
  { ticker: "DDOG",  companyName: "Datadog Inc",                 sector: "Technology",              industry: "Software—Application",           marketCap: 22_000_000_000 },
  { ticker: "SNOW",  companyName: "Snowflake Inc",               sector: "Technology",              industry: "Software—Application",           marketCap: 30_000_000_000 },
  { ticker: "ZS",    companyName: "Zscaler Inc",                 sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 15_000_000_000 },
  { ticker: "OKTA",  companyName: "Okta Inc",                    sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 10_000_000_000 },
  { ticker: "MDB",   companyName: "MongoDB Inc",                 sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 12_000_000_000 },
  { ticker: "HUBS",  companyName: "HubSpot Inc",                 sector: "Technology",              industry: "Software—Application",           marketCap: 20_000_000_000 },
  { ticker: "TWLO",  companyName: "Twilio Inc",                  sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 8_000_000_000  },
  { ticker: "U",     companyName: "Unity Software",              sector: "Technology",              industry: "Software—Application",           marketCap: 3_500_000_000  },
  { ticker: "MNDY",  companyName: "Monday.com Ltd",              sector: "Technology",              industry: "Software—Application",           marketCap: 10_000_000_000 },
  { ticker: "GTLB",  companyName: "GitLab Inc",                  sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 7_000_000_000  },
  { ticker: "CFLT",  companyName: "Confluent Inc",               sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 4_500_000_000  },
  { ticker: "FOUR",  companyName: "Shift4 Payments",             sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 4_000_000_000  },
  { ticker: "SEZL",  companyName: "Sezzle Inc",                  sector: "Technology",              industry: "Software—Application",           marketCap: 600_000_000    },
  { ticker: "UPST",  companyName: "Upstart Holdings",            sector: "Technology",              industry: "Credit Services",                marketCap: 2_500_000_000  },
  { ticker: "BILL",  companyName: "Bill.com Holdings",           sector: "Technology",              industry: "Software—Application",           marketCap: 4_000_000_000  },
  { ticker: "APPN",  companyName: "Appian Corp",                 sector: "Technology",              industry: "Software—Application",           marketCap: 1_800_000_000  },
  { ticker: "DOCN",  companyName: "DigitalOcean Holdings",       sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 3_500_000_000  },
  { ticker: "ESTC",  companyName: "Elastic NV",                  sector: "Technology",              industry: "Software—Application",           marketCap: 6_000_000_000  },
  { ticker: "NTNX",  companyName: "Nutanix Inc",                 sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 12_000_000_000 },
  { ticker: "PCTY",  companyName: "Paylocity Holding",           sector: "Technology",              industry: "Software—Application",           marketCap: 6_500_000_000  },
  { ticker: "WEX",   companyName: "WEX Inc",                     sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 5_500_000_000  },
  { ticker: "ZI",    companyName: "ZoomInfo Technologies",       sector: "Technology",              industry: "Software—Application",           marketCap: 3_500_000_000  },
  { ticker: "DUOL",  companyName: "Duolingo Inc",                sector: "Technology",              industry: "Software—Application",           marketCap: 8_000_000_000  },
  { ticker: "SE",    companyName: "Sea Limited",                  sector: "Technology",              industry: "Internet Retail",                marketCap: 25_000_000_000 },
  { ticker: "SHOP",  companyName: "Shopify Inc",                 sector: "Technology",              industry: "Software—Application",           marketCap: 45_000_000_000 },
  { ticker: "IOT",   companyName: "Samsara Inc",                 sector: "Technology",              industry: "Software—Application",           marketCap: 12_000_000_000 },
  { ticker: "FTNT",  companyName: "Fortinet Inc",                sector: "Technology",              industry: "Software—Infrastructure",        marketCap: 35_000_000_000 },
  { ticker: "NCNO",  companyName: "nCino Inc",                   sector: "Technology",              industry: "Software—Application",           marketCap: 2_800_000_000  },
  { ticker: "ACMR",  companyName: "ACM Research",                sector: "Technology",              industry: "Semiconductor Equipment",        marketCap: 1_200_000_000  },
  { ticker: "ONTO",  companyName: "Onto Innovation",             sector: "Technology",              industry: "Semiconductor Equipment",        marketCap: 3_500_000_000  },
  { ticker: "IPGP",  companyName: "IPG Photonics",               sector: "Technology",              industry: "Electronic Components",          marketCap: 4_000_000_000  },
  { ticker: "POWI",  companyName: "Power Integrations",          sector: "Technology",              industry: "Semiconductors",                 marketCap: 2_000_000_000  },
  { ticker: "AEHR",  companyName: "Aehr Test Systems",           sector: "Technology",              industry: "Semiconductor Equipment",        marketCap: 500_000_000    },
  { ticker: "CRDO",  companyName: "Credo Technology Group",      sector: "Technology",              industry: "Semiconductors",                 marketCap: 4_000_000_000  },
  { ticker: "FORM",  companyName: "FormFactor Inc",              sector: "Technology",              industry: "Semiconductor Equipment",        marketCap: 1_200_000_000  },

  // ── Communication Services ────────────────────────────────────────────────
  { ticker: "RDDT",  companyName: "Reddit Inc",                  sector: "Communication Services",  industry: "Internet Content & Information", marketCap: 12_000_000_000 },
  { ticker: "SNAP",  companyName: "Snap Inc",                    sector: "Communication Services",  industry: "Internet Content & Information", marketCap: 8_000_000_000  },
  { ticker: "PINS",  companyName: "Pinterest Inc",               sector: "Communication Services",  industry: "Internet Content & Information", marketCap: 14_000_000_000 },
  { ticker: "HOOD",  companyName: "Robinhood Markets",           sector: "Communication Services",  industry: "Capital Markets",                marketCap: 18_000_000_000 },
  { ticker: "DV",    companyName: "DoubleVerify Holdings",       sector: "Communication Services",  industry: "Software—Application",           marketCap: 2_500_000_000  },
  { ticker: "ZETA",  companyName: "Zeta Global Holdings",        sector: "Communication Services",  industry: "Software—Application",           marketCap: 3_000_000_000  },
  { ticker: "MGNI",  companyName: "Magnite Inc",                 sector: "Communication Services",  industry: "Internet Content & Information", marketCap: 1_200_000_000  },
  { ticker: "PUBM",  companyName: "PubMatic Inc",                sector: "Communication Services",  industry: "Internet Content & Information", marketCap: 700_000_000    },
  { ticker: "ANGI",  companyName: "Angi Inc",                    sector: "Communication Services",  industry: "Internet Content & Information", marketCap: 600_000_000    },
  { ticker: "IAS",   companyName: "Integral Ad Science",         sector: "Communication Services",  industry: "Software—Application",           marketCap: 1_500_000_000  },

  // ── Healthcare ────────────────────────────────────────────────────────────
  { ticker: "HIMS",  companyName: "Hims & Hers Health",          sector: "Healthcare",              industry: "Health Information Services",    marketCap: 3_000_000_000  },
  { ticker: "TDOC",  companyName: "Teladoc Health",              sector: "Healthcare",              industry: "Health Information Services",    marketCap: 1_500_000_000  },
  { ticker: "DXCM",  companyName: "Dexcom Inc",                  sector: "Healthcare",              industry: "Medical Devices",                marketCap: 20_000_000_000 },
  { ticker: "ALGN",  companyName: "Align Technology",            sector: "Healthcare",              industry: "Medical Devices",                marketCap: 10_000_000_000 },
  { ticker: "IRTC",  companyName: "iRhythm Technologies",        sector: "Healthcare",              industry: "Medical Devices",                marketCap: 2_000_000_000  },
  { ticker: "NTRA",  companyName: "Natera Inc",                  sector: "Healthcare",              industry: "Diagnostics & Research",         marketCap: 12_000_000_000 },
  { ticker: "EXAS",  companyName: "Exact Sciences",              sector: "Healthcare",              industry: "Diagnostics & Research",         marketCap: 6_000_000_000  },
  { ticker: "GKOS",  companyName: "Glaukos Corp",                sector: "Healthcare",              industry: "Medical Devices",                marketCap: 4_000_000_000  },
  { ticker: "DOCS",  companyName: "Doximity Inc",                sector: "Healthcare",              industry: "Health Information Services",    marketCap: 6_000_000_000  },
  { ticker: "PGNY",  companyName: "Progyny Inc",                 sector: "Healthcare",              industry: "Health Information Services",    marketCap: 1_200_000_000  },
  { ticker: "ACAD",  companyName: "ACADIA Pharmaceuticals",      sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 3_500_000_000  },
  { ticker: "IONS",  companyName: "Ionis Pharmaceuticals",       sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 5_000_000_000  },
  { ticker: "ARWR",  companyName: "Arrowhead Pharmaceuticals",   sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 2_500_000_000  },
  { ticker: "BEAM",  companyName: "Beam Therapeutics",           sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 1_200_000_000  },
  { ticker: "JAZZ",  companyName: "Jazz Pharmaceuticals",        sector: "Healthcare",              industry: "Drug Manufacturers",             marketCap: 5_000_000_000  },
  { ticker: "PRAX",  companyName: "Praxis Precision Medicine",   sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 2_000_000_000  },
  { ticker: "CYTK",  companyName: "Cytokinetics Inc",            sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 4_000_000_000  },
  { ticker: "KROS",  companyName: "Karros Oncology",             sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 900_000_000    },
  { ticker: "NKTR",  companyName: "Nektar Therapeutics",         sector: "Healthcare",              industry: "Biotechnology",                  marketCap: 600_000_000    },
  { ticker: "AMED",  companyName: "Amedisys Inc",                sector: "Healthcare",              industry: "Medical Care Facilities",        marketCap: 2_800_000_000  },

  // ── Industrials ───────────────────────────────────────────────────────────
  { ticker: "AXON",  companyName: "Axon Enterprise",             sector: "Industrials",             industry: "Aerospace & Defense",            marketCap: 30_000_000_000 },
  { ticker: "LDOS",  companyName: "Leidos Holdings",             sector: "Industrials",             industry: "Defense Contractors",            marketCap: 20_000_000_000 },
  { ticker: "CACI",  companyName: "CACI International",          sector: "Industrials",             industry: "Defense Contractors",            marketCap: 8_000_000_000  },
  { ticker: "SAIC",  companyName: "Science Applications International", sector: "Industrials",     industry: "Defense Contractors",            marketCap: 6_000_000_000  },
  { ticker: "KTOS",  companyName: "Kratos Defense & Security",   sector: "Industrials",             industry: "Aerospace & Defense",            marketCap: 4_000_000_000  },
  { ticker: "RKLB",  companyName: "Rocket Lab USA",              sector: "Industrials",             industry: "Aerospace & Defense",            marketCap: 6_000_000_000  },
  { ticker: "ASTS",  companyName: "AST SpaceMobile",             sector: "Industrials",             industry: "Communication Equipment",        marketCap: 4_500_000_000  },
  { ticker: "ACHR",  companyName: "Archer Aviation",             sector: "Industrials",             industry: "Aerospace & Defense",            marketCap: 3_000_000_000  },
  { ticker: "JOBY",  companyName: "Joby Aviation",               sector: "Industrials",             industry: "Aerospace & Defense",            marketCap: 4_500_000_000  },
  { ticker: "LUNR",  companyName: "Intuitive Machines",          sector: "Industrials",             industry: "Aerospace & Defense",            marketCap: 1_500_000_000  },
  { ticker: "CDRE",  companyName: "Cadre Holdings",              sector: "Industrials",             industry: "Aerospace & Defense",            marketCap: 900_000_000    },
  { ticker: "HAYW",  companyName: "Hayward Holdings",            sector: "Industrials",             industry: "Specialty Industrial Machinery", marketCap: 2_000_000_000  },
  { ticker: "ATKR",  companyName: "Atkore Inc",                  sector: "Industrials",             industry: "Electrical Equipment & Parts",   marketCap: 2_500_000_000  },
  { ticker: "FWRD",  companyName: "Forward Air Corp",            sector: "Industrials",             industry: "Integrated Freight & Logistics", marketCap: 1_200_000_000  },
  { ticker: "GXO",   companyName: "GXO Logistics",               sector: "Industrials",             industry: "Integrated Freight & Logistics", marketCap: 4_500_000_000  },
  { ticker: "TTEK",  companyName: "Tetra Tech Inc",              sector: "Industrials",             industry: "Engineering & Construction",     marketCap: 5_000_000_000  },

  // ── Energy ────────────────────────────────────────────────────────────────
  { ticker: "CTRA",  companyName: "Coterra Energy",              sector: "Energy",                  industry: "Oil & Gas E&P",                  marketCap: 16_000_000_000 },
  { ticker: "CHRD",  companyName: "Chord Energy",                sector: "Energy",                  industry: "Oil & Gas E&P",                  marketCap: 6_000_000_000  },
  { ticker: "VALO",  companyName: "Valaris Ltd",                 sector: "Energy",                  industry: "Oil & Gas Drilling",             marketCap: 3_500_000_000  },
  { ticker: "BORR",  companyName: "Borr Drilling",               sector: "Energy",                  industry: "Oil & Gas Drilling",             marketCap: 900_000_000    },
  { ticker: "WHD",   companyName: "Cactus Inc",                  sector: "Energy",                  industry: "Oil & Gas Equipment & Services", marketCap: 2_500_000_000  },
  { ticker: "CELH",  companyName: "Celsius Holdings",            sector: "Energy",                  industry: "Beverages—Non-Alcoholic",        marketCap: 3_500_000_000  },
  { ticker: "RRC",   companyName: "Range Resources",             sector: "Energy",                  industry: "Oil & Gas E&P",                  marketCap: 4_000_000_000  },
  { ticker: "SWN",   companyName: "Southwestern Energy",         sector: "Energy",                  industry: "Oil & Gas E&P",                  marketCap: 2_000_000_000  },

  // ── Utilities (data center / power infrastructure) ────────────────────────
  { ticker: "EQIX",  companyName: "Equinix Inc",                 sector: "Utilities",               industry: "Data Center REITs",              marketCap: 48_000_000_000 },
  { ticker: "DLR",   companyName: "Digital Realty Trust",        sector: "Utilities",               industry: "Data Center REITs",              marketCap: 40_000_000_000 },
  { ticker: "CLNC",  companyName: "Clearway Energy",             sector: "Utilities",               industry: "Utilities—Renewable",            marketCap: 2_500_000_000  },
  { ticker: "AES",   companyName: "AES Corp",                    sector: "Utilities",               industry: "Utilities—Diversified",          marketCap: 8_000_000_000  },
  { ticker: "BEP",   companyName: "Brookfield Renewable",        sector: "Utilities",               industry: "Utilities—Renewable",            marketCap: 10_000_000_000 },
  { ticker: "NOVA",  companyName: "Sunnova Energy",              sector: "Utilities",               industry: "Utilities—Renewable",            marketCap: 600_000_000    },
  { ticker: "ARRY",  companyName: "Array Technologies",          sector: "Utilities",               industry: "Solar",                          marketCap: 1_200_000_000  },
  { ticker: "MAXN",  companyName: "Maxeon Solar Technologies",   sector: "Utilities",               industry: "Solar",                          marketCap: 500_000_000    },
  { ticker: "SHLS",  companyName: "Shoals Technologies",         sector: "Utilities",               industry: "Solar",                          marketCap: 800_000_000    },
  { ticker: "AMBP",  companyName: "Ardagh Metal Packaging",      sector: "Utilities",               industry: "Packaging & Containers",         marketCap: 1_500_000_000  },

  // ── Financials / Fintech ──────────────────────────────────────────────────
  { ticker: "NU",    companyName: "Nu Holdings",                 sector: "Technology",              industry: "Credit Services",                marketCap: 50_000_000_000 },
  { ticker: "AFRM",  companyName: "Affirm Holdings",             sector: "Technology",              industry: "Credit Services",                marketCap: 12_000_000_000 },
  { ticker: "SOFI",  companyName: "SoFi Technologies",           sector: "Technology",              industry: "Credit Services",                marketCap: 8_000_000_000  },
  { ticker: "DAVE",  companyName: "Dave Inc",                    sector: "Technology",              industry: "Software—Application",           marketCap: 700_000_000    },
  { ticker: "RELY",  companyName: "Remitly Global",              sector: "Technology",              industry: "Software—Application",           marketCap: 2_500_000_000  },
  { ticker: "PAYO",  companyName: "Payoneer Global",             sector: "Technology",              industry: "Software—Application",           marketCap: 1_800_000_000  },
  { ticker: "FLYW",  companyName: "Flywire Corp",                sector: "Technology",              industry: "Software—Application",           marketCap: 1_200_000_000  },
  { ticker: "PRCT",  companyName: "PROCEPT BioRobotics",         sector: "Healthcare",              industry: "Medical Devices",                marketCap: 3_500_000_000  },

  // ── Consumer / High Growth ────────────────────────────────────────────────
  { ticker: "ONON",  companyName: "On Holding AG",               sector: "Technology",              industry: "Footwear & Accessories",         marketCap: 18_000_000_000 },
  { ticker: "DECK",  companyName: "Deckers Outdoor",             sector: "Technology",              industry: "Footwear & Accessories",         marketCap: 15_000_000_000 },
  { ticker: "FICO",  companyName: "Fair Isaac Corp",             sector: "Technology",              industry: "Software—Application",           marketCap: 40_000_000_000 },
  { ticker: "CPNG",  companyName: "Coupang Inc",                 sector: "Technology",              industry: "Internet Retail",                marketCap: 30_000_000_000 },
  { ticker: "MELI",  companyName: "MercadoLibre Inc",            sector: "Technology",              industry: "Internet Retail",                marketCap: 48_000_000_000 },
  { ticker: "GLOB",  companyName: "Globant SA",                  sector: "Technology",              industry: "Information Technology Services", marketCap: 3_500_000_000  },
];
