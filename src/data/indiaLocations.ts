// Canonical India Master Location System Data

export interface MasterCityData {
  name: string;
  pincodes: string[];
}

export interface MasterStateData {
  name: string;
  cities: { [cityKey: string]: MasterCityData };
}

export const MASTER_LOCATIONS: { [stateKey: string]: MasterStateData } = {
  "andamannicobarislands": {
    "name": "Andaman & Nicobar Islands",
    "cities": {
      "portblair": {
        "name": "Port Blair",
        "pincodes": [
          "744105"
        ]
      }
    }
  },
  "andhrapradesh": {
    "name": "Andhra Pradesh",
    "cities": {
      "anaparthi": {
        "name": "Anaparthi",
        "pincodes": [
          "533342"
        ]
      },
      "chittoor": {
        "name": "Chittoor",
        "pincodes": [
          "517001",
          "517581"
        ]
      },
      "cuddapah": {
        "name": "Cuddapah",
        "pincodes": [
          "516267",
          "516309"
        ]
      },
      "durgi": {
        "name": "Durgi",
        "pincodes": [
          "522612"
        ]
      },
      "eastgodavari": {
        "name": "East Godavari",
        "pincodes": [
          "533221",
          "533429"
        ]
      },
      "garbham": {
        "name": "Garbham",
        "pincodes": [
          "535102"
        ]
      },
      "gudivada": {
        "name": "Gudivada",
        "pincodes": [
          "521321"
        ]
      },
      "guntakal": {
        "name": "Guntakal",
        "pincodes": [
          "515801"
        ]
      },
      "guntur": {
        "name": "Guntur",
        "pincodes": [
          "522005",
          "522124",
          "522403",
          "522501"
        ]
      },
      "hanumanjunction": {
        "name": "Hanuman Junction",
        "pincodes": [
          "521105"
        ]
      },
      "kaikaluru": {
        "name": "Kaikaluru",
        "pincodes": [
          "521333"
        ]
      },
      "kakinada": {
        "name": "Kakinada",
        "pincodes": [
          "533001",
          "533003",
          "533004"
        ]
      },
      "krishna": {
        "name": "Krishna",
        "pincodes": [
          "521109"
        ]
      },
      "kurnool": {
        "name": "Kurnool",
        "pincodes": [
          "518395"
        ]
      },
      "machilipatnam": {
        "name": "Machilipatnam",
        "pincodes": [
          "521125"
        ]
      },
      "madakasira": {
        "name": "Madakasira",
        "pincodes": [
          "515281"
        ]
      },
      "mandapeta": {
        "name": "Mandapeta",
        "pincodes": [
          "533346"
        ]
      },
      "mangalagiri": {
        "name": "Mangalagiri",
        "pincodes": [
          "522502"
        ]
      },
      "maruteru": {
        "name": "Maruteru",
        "pincodes": [
          "534122"
        ]
      },
      "nandyal": {
        "name": "Nandyal",
        "pincodes": [
          "518502"
        ]
      },
      "narasaraopet": {
        "name": "Narasaraopet",
        "pincodes": [
          "522601"
        ]
      },
      "nellore": {
        "name": "Nellore",
        "pincodes": [
          "524004",
          "524132"
        ]
      },
      "ongole": {
        "name": "Ongole",
        "pincodes": [
          "523001"
        ]
      },
      "ponnur": {
        "name": "Ponnur",
        "pincodes": [
          "522124"
        ]
      },
      "prakasam": {
        "name": "Prakasam",
        "pincodes": [
          "523002"
        ]
      },
      "puthalapattu": {
        "name": "Puthalapattu",
        "pincodes": [
          "517124"
        ]
      },
      "puttur": {
        "name": "Puttur",
        "pincodes": [
          "517583"
        ]
      },
      "rajahmundry": {
        "name": "Rajahmundry",
        "pincodes": [
          "533103",
          "533234"
        ]
      },
      "salur": {
        "name": "Salur",
        "pincodes": [
          "535591"
        ]
      },
      "samarlakota": {
        "name": "Samarlakota",
        "pincodes": [
          "533435"
        ]
      },
      "srikakulam": {
        "name": "Srikakulam",
        "pincodes": [
          "532001"
        ]
      },
      "srisailam": {
        "name": "Srisailam",
        "pincodes": [
          "518101"
        ]
      },
      "tada": {
        "name": "Tada",
        "pincodes": [
          "524401"
        ]
      },
      "tadikonda": {
        "name": "Tadikonda",
        "pincodes": [
          "522237"
        ]
      },
      "thamballapalli": {
        "name": "Thamballapalli",
        "pincodes": [
          "517418"
        ]
      },
      "tirupati": {
        "name": "Tirupati",
        "pincodes": [
          "517501",
          "517503",
          "517561"
        ]
      },
      "tuni": {
        "name": "Tuni",
        "pincodes": [
          "531126"
        ]
      },
      "veereswarapuram": {
        "name": "Veereswarapuram",
        "pincodes": [
          "534196"
        ]
      },
      "venkatagirikota": {
        "name": "Venkatagirikota",
        "pincodes": [
          "517424"
        ]
      },
      "vijayawada": {
        "name": "Vijayawada",
        "pincodes": [
          "520010",
          "520015"
        ]
      },
      "visakhapatnam": {
        "name": "Visakhapatnam",
        "pincodes": [
          "530007",
          "530009",
          "530017",
          "530026",
          "530040",
          "530041",
          "530046",
          "531116"
        ]
      },
      "westgodavari": {
        "name": "West Godavari",
        "pincodes": [
          "534240",
          "534275",
          "534312",
          "534460"
        ]
      },
      "yellamanchili": {
        "name": "Yellamanchili",
        "pincodes": [
          "531055"
        ]
      }
    }
  },
  "arunachalpradesh": {
    "name": "Arunachal Pradesh",
    "cities": {
      "papumpare": {
        "name": "Papum Pare",
        "pincodes": [
          "791113"
        ]
      }
    }
  },
  "assam": {
    "name": "Assam",
    "cities": {
      "sonitpur": {
        "name": "Sonitpur",
        "pincodes": [
          "784001"
        ]
      }
    }
  },
  "bihar": {
    "name": "Bihar",
    "cities": {
      "kanti": {
        "name": "Kanti",
        "pincodes": [
          "843130"
        ]
      }
    }
  },
  "chhattisgarh": {
    "name": "Chhattisgarh",
    "cities": {
      "bhilai": {
        "name": "Bhilai",
        "pincodes": [
          "490023"
        ]
      },
      "durg": {
        "name": "Durg",
        "pincodes": [
          "490009"
        ]
      }
    }
  },
  "dadranagarhaveli": {
    "name": "Dadra & Nagar Haveli",
    "cities": {
      "silvassa": {
        "name": "Silvassa",
        "pincodes": [
          "396230"
        ]
      }
    }
  },
  "delhi": {
    "name": "Delhi",
    "cities": {
      "delhi": {
        "name": "Delhi",
        "pincodes": [
          "110025",
          "110053"
        ]
      },
      "newdelhi": {
        "name": "New Delhi",
        "pincodes": [
          "110002",
          "110018",
          "110070"
        ]
      }
    }
  },
  "goa": {
    "name": "Goa",
    "cities": {
      "goa": {
        "name": "Goa",
        "pincodes": [
          "403802"
        ]
      },
      "reismagos": {
        "name": "Reis Magos",
        "pincodes": [
          "403114"
        ]
      }
    }
  },
  "gujarat": {
    "name": "Gujarat",
    "cities": {
      "ahmedabad": {
        "name": "Ahmedabad",
        "pincodes": [
          "380061"
        ]
      },
      "godhavi": {
        "name": "Godhavi",
        "pincodes": [
          "382115"
        ]
      },
      "surat": {
        "name": "Surat",
        "pincodes": [
          "394210",
          "395007"
        ]
      },
      "vadodara": {
        "name": "Vadodara",
        "pincodes": [
          "390014"
        ]
      }
    }
  },
  "haryana": {
    "name": "Haryana",
    "cities": {
      "pataudi": {
        "name": "Pataudi",
        "pincodes": [
          "122503"
        ]
      },
      "rohtak": {
        "name": "Rohtak",
        "pincodes": [
          "124001"
        ]
      }
    }
  },
  "jharkhand": {
    "name": "Jharkhand",
    "cities": {
      "chaibasa": {
        "name": "Chaibasa",
        "pincodes": [
          "833201"
        ]
      }
    }
  },
  "karnataka": {
    "name": "Karnataka",
    "cities": {
      "arekere": {
        "name": "Arekere",
        "pincodes": [
          "560076"
        ]
      },
      "bangalore": {
        "name": "Bangalore",
        "pincodes": [
          "560001",
          "560002",
          "560005",
          "560006",
          "560008",
          "560010",
          "560015",
          "560016",
          "560021",
          "560023",
          "560026",
          "560029",
          "560030",
          "560032",
          "560033",
          "560035",
          "560036",
          "560039",
          "560040",
          "560043",
          "560045",
          "560047",
          "560048",
          "560049",
          "560053",
          "560054",
          "560056",
          "560058",
          "560060",
          "560061",
          "560064",
          "560065",
          "560066",
          "560067",
          "560068",
          "560075",
          "560076",
          "560077",
          "560079",
          "560082",
          "560083",
          "560084",
          "560085",
          "560086",
          "560090",
          "560091",
          "560092",
          "560093",
          "560095",
          "560097",
          "560098",
          "560099",
          "560100",
          "560102",
          "560105",
          "560109",
          "560114",
          "562105",
          "562125",
          "562130",
          "562149",
          "562157"
        ]
      },
      "bangalorenorth": {
        "name": "Bangalore North",
        "pincodes": [
          "560063"
        ]
      },
      "banglore": {
        "name": "Banglore",
        "pincodes": [
          "560810"
        ]
      },
      "belgaum": {
        "name": "Belgaum",
        "pincodes": [
          "591108"
        ]
      },
      "bellary": {
        "name": "Bellary",
        "pincodes": [
          "583101",
          "583104",
          "583123"
        ]
      },
      "bengaluru": {
        "name": "Bengaluru",
        "pincodes": [
          "560016",
          "560032",
          "560034",
          "560035",
          "560042",
          "560043",
          "560058",
          "560060",
          "560066",
          "560083",
          "560100"
        ]
      },
      "bengalururural": {
        "name": "Bengaluru Rural",
        "pincodes": [
          "562135"
        ]
      },
      "bhadravathi": {
        "name": "Bhadravathi",
        "pincodes": [
          "577301"
        ]
      },
      "bilekahalli": {
        "name": "Bilekahalli",
        "pincodes": [
          "560076"
        ]
      },
      "channapatna": {
        "name": "Channapatna",
        "pincodes": [
          "562160"
        ]
      },
      "channarayapatna": {
        "name": "Channarayapatna",
        "pincodes": [
          "573111"
        ]
      },
      "dakshinakannada": {
        "name": "Dakshina Kannada",
        "pincodes": [
          "574221"
        ]
      },
      "davanagere": {
        "name": "Davanagere",
        "pincodes": [
          "577004"
        ]
      },
      "dharmasthala": {
        "name": "Dharmasthala",
        "pincodes": [
          "574216"
        ]
      },
      "gonikoppal": {
        "name": "Gonikoppal",
        "pincodes": [
          "571216"
        ]
      },
      "hiriyur": {
        "name": "Hiriyur",
        "pincodes": [
          "577598"
        ]
      },
      "hospet": {
        "name": "Hospet",
        "pincodes": [
          "583201"
        ]
      },
      "kadaba": {
        "name": "Kadaba",
        "pincodes": [
          "574230"
        ]
      },
      "kadur": {
        "name": "Kadur",
        "pincodes": [
          "577548"
        ]
      },
      "karkala": {
        "name": "Karkala",
        "pincodes": [
          "574104"
        ]
      },
      "kolar": {
        "name": "Kolar",
        "pincodes": [
          "563101"
        ]
      },
      "koppak": {
        "name": "Koppak",
        "pincodes": [
          "577134"
        ]
      },
      "kotturu": {
        "name": "Kotturu",
        "pincodes": [
          "583134"
        ]
      },
      "mangalore": {
        "name": "Mangalore",
        "pincodes": [
          "575006",
          "575015"
        ]
      },
      "mysore": {
        "name": "Mysore",
        "pincodes": [
          "570007",
          "570016",
          "570017",
          "570019",
          "570023",
          "570026",
          "570030",
          "571606"
        ]
      },
      "mysuru": {
        "name": "Mysuru",
        "pincodes": [
          "570010"
        ]
      },
      "nanjangudu": {
        "name": "Nanjangudu",
        "pincodes": [
          "571312"
        ]
      },
      "navalgund": {
        "name": "Navalgund",
        "pincodes": [
          "582208"
        ]
      },
      "puttur": {
        "name": "Puttur",
        "pincodes": [
          "574241"
        ]
      },
      "shimoga": {
        "name": "Shimoga",
        "pincodes": [
          "577204"
        ]
      },
      "surathkal": {
        "name": "Surathkal",
        "pincodes": [
          "575014",
          "575019"
        ]
      },
      "tumkur": {
        "name": "Tumkur",
        "pincodes": [
          "572227"
        ]
      },
      "udupi": {
        "name": "Udupi",
        "pincodes": [
          "576201"
        ]
      },
      "ullal": {
        "name": "Ullal",
        "pincodes": [
          "575023"
        ]
      }
    }
  },
  "kerala": {
    "name": "Kerala",
    "cities": {
      "adoor": {
        "name": "Adoor",
        "pincodes": [
          "691530",
          "691551",
          "691555"
        ]
      },
      "alakode": {
        "name": "Alakode",
        "pincodes": [
          "670631"
        ]
      },
      "alanallur": {
        "name": "Alanallur",
        "pincodes": [
          "678601"
        ]
      },
      "alappuzha": {
        "name": "Alappuzha",
        "pincodes": [
          "688001",
          "688005",
          "688012",
          "688013",
          "688014",
          "688524",
          "688535",
          "688537",
          "688538",
          "688561",
          "690104",
          "690107",
          "690502",
          "690504",
          "690505",
          "690512",
          "690514",
          "690559"
        ]
      },
      "alathur": {
        "name": "Alathur",
        "pincodes": [
          "678541",
          "678703"
        ]
      },
      "alur": {
        "name": "Alur",
        "pincodes": [
          "680697"
        ]
      },
      "aluva": {
        "name": "Aluva",
        "pincodes": [
          "683101",
          "683102",
          "683108",
          "683112",
          "683561",
          "683563"
        ]
      },
      "angamaly": {
        "name": "Angamaly",
        "pincodes": [
          "683572",
          "683574",
          "683577",
          "683579",
          "683581",
          "683585",
          "683589"
        ]
      },
      "anjumoorthy": {
        "name": "Anjumoorthy",
        "pincodes": [
          "678684"
        ]
      },
      "areacode": {
        "name": "Areacode",
        "pincodes": [
          "673639"
        ]
      },
      "arimbur": {
        "name": "Arimbur",
        "pincodes": [
          "680612"
        ]
      },
      "ashtamichira": {
        "name": "Ashtamichira",
        "pincodes": [
          "680731"
        ]
      },
      "athani": {
        "name": "Athani",
        "pincodes": [
          "683585"
        ]
      },
      "attingal": {
        "name": "Attingal",
        "pincodes": [
          "695101",
          "695102",
          "695104",
          "695303",
          "695304",
          "695308"
        ]
      },
      "ayakkad": {
        "name": "Ayakkad",
        "pincodes": [
          "678683"
        ]
      },
      "ayyampilly": {
        "name": "Ayyampilly",
        "pincodes": [
          "682501"
        ]
      },
      "calicut": {
        "name": "Calicut",
        "pincodes": [
          "673016"
        ]
      },
      "cannanore": {
        "name": "Cannanore",
        "pincodes": [
          "670602",
          "670633"
        ]
      },
      "chalakudy": {
        "name": "Chalakudy",
        "pincodes": [
          "680302",
          "680307",
          "680308",
          "680309",
          "680697",
          "680721",
          "680732",
          "680741"
        ]
      },
      "changanacherry": {
        "name": "Changanacherry",
        "pincodes": [
          "686104"
        ]
      },
      "changanassery": {
        "name": "Changanassery",
        "pincodes": [
          "686101"
        ]
      },
      "changancherry": {
        "name": "Changancherry",
        "pincodes": [
          "686104"
        ]
      },
      "chavakkad": {
        "name": "Chavakkad",
        "pincodes": [
          "680514",
          "680687"
        ]
      },
      "chendrappini": {
        "name": "Chendrappini",
        "pincodes": [
          "680687"
        ]
      },
      "chengannur": {
        "name": "Chengannur",
        "pincodes": [
          "689126"
        ]
      },
      "cherthala": {
        "name": "Cherthala",
        "pincodes": [
          "688524",
          "688526",
          "688528",
          "688530",
          "688532",
          "688533",
          "688536"
        ]
      },
      "chingavanam": {
        "name": "Chingavanam",
        "pincodes": [
          "686012"
        ]
      },
      "chungatharapomalappuramdis": {
        "name": "Chungathara Po Malappuram Dis",
        "pincodes": [
          "679334"
        ]
      },
      "cochin": {
        "name": "Cochin",
        "pincodes": [
          "682006",
          "682015",
          "682017",
          "682019",
          "682020",
          "682021",
          "682025",
          "682030",
          "682032",
          "682301",
          "682304",
          "682305",
          "682307",
          "682313",
          "682314",
          "682317"
        ]
      },
      "edapally": {
        "name": "Edapally",
        "pincodes": [
          "682024"
        ]
      },
      "edappal": {
        "name": "Edappal",
        "pincodes": [
          "679573",
          "679576"
        ]
      },
      "edavanakad": {
        "name": "Edavanakad",
        "pincodes": [
          "682502"
        ]
      },
      "elamakkara": {
        "name": "Elamakkara",
        "pincodes": [
          "682012",
          "682023",
          "682034"
        ]
      },
      "eloor": {
        "name": "Eloor",
        "pincodes": [
          "683501"
        ]
      },
      "ernakulam": {
        "name": "Ernakulam",
        "pincodes": [
          "682008",
          "682011",
          "682015",
          "682017",
          "682021",
          "682023",
          "682024",
          "682028",
          "682030",
          "682034",
          "682305",
          "682308",
          "682311",
          "682505",
          "682506",
          "682509",
          "682511",
          "683104",
          "683106",
          "683112",
          "683514",
          "683521",
          "683541",
          "683543",
          "683545",
          "683556",
          "683572",
          "683585",
          "683589",
          "686664"
        ]
      },
      "ernakulamdist": {
        "name": "Ernakulam Dist",
        "pincodes": [
          "682310"
        ]
      },
      "guruvayoor": {
        "name": "Guruvayoor",
        "pincodes": [
          "680101",
          "680104",
          "680506"
        ]
      },
      "haripad": {
        "name": "Haripad",
        "pincodes": [
          "690103",
          "690506",
          "690511",
          "690514"
        ]
      },
      "hosangadi": {
        "name": "Hosangadi",
        "pincodes": [
          "671323"
        ]
      },
      "idukki": {
        "name": "Idukki",
        "pincodes": [
          "685508",
          "685509",
          "685585",
          "685608",
          "685609"
        ]
      },
      "irikkur": {
        "name": "Irikkur",
        "pincodes": [
          "670593"
        ]
      },
      "irikkurkannur": {
        "name": "Irikkur Kannur",
        "pincodes": [
          "670593"
        ]
      },
      "irinjalakuda": {
        "name": "Irinjalakuda",
        "pincodes": [
          "680121",
          "680310",
          "680317",
          "680566",
          "680663",
          "680683",
          "680688",
          "680702",
          "680703"
        ]
      },
      "iritty": {
        "name": "Iritty",
        "pincodes": [
          "670702"
        ]
      },
      "kadakkal": {
        "name": "Kadakkal",
        "pincodes": [
          "691536",
          "691539"
        ]
      },
      "kadakkavoor": {
        "name": "Kadakkavoor",
        "pincodes": [
          "695309"
        ]
      },
      "kadampuzha": {
        "name": "Kadampuzha",
        "pincodes": [
          "676553"
        ]
      },
      "kakkanad": {
        "name": "Kakkanad",
        "pincodes": [
          "682303"
        ]
      },
      "kallachi": {
        "name": "Kallachi",
        "pincodes": [
          "673506"
        ]
      },
      "kallikkad": {
        "name": "Kallikkad",
        "pincodes": [
          "695571"
        ]
      },
      "kalpakancherymalappuram": {
        "name": "Kalpakanchery Malappuram",
        "pincodes": [
          "676551"
        ]
      },
      "kalpetta": {
        "name": "Kalpetta",
        "pincodes": [
          "673124"
        ]
      },
      "kandalloor": {
        "name": "Kandalloor",
        "pincodes": [
          "690531"
        ]
      },
      "kanhangad": {
        "name": "Kanhangad",
        "pincodes": [
          "671531"
        ]
      },
      "kannur": {
        "name": "Kannur",
        "pincodes": [
          "670003",
          "670005",
          "670301",
          "670331",
          "670594",
          "670604",
          "670611",
          "670691"
        ]
      },
      "karthikappally": {
        "name": "Karthikappally",
        "pincodes": [
          "690516"
        ]
      },
      "karukachal": {
        "name": "Karukachal",
        "pincodes": [
          "686502",
          "686540",
          "686546"
        ]
      },
      "karunagappally": {
        "name": "Karunagappally",
        "pincodes": [
          "690519",
          "690523",
          "690526",
          "690573",
          "690574",
          "691584"
        ]
      },
      "karuvanchal": {
        "name": "Karuvanchal",
        "pincodes": [
          "670571"
        ]
      },
      "kasaragod": {
        "name": "Kasaragod",
        "pincodes": [
          "671121",
          "671317",
          "671319"
        ]
      },
      "kasargod": {
        "name": "Kasargod",
        "pincodes": [
          "671123",
          "671124",
          "671531"
        ]
      },
      "kattappana": {
        "name": "Kattappana",
        "pincodes": [
          "685508"
        ]
      },
      "kayamkulam": {
        "name": "Kayamkulam",
        "pincodes": [
          "690502",
          "690503",
          "690533",
          "690535",
          "690559"
        ]
      },
      "kazhakkoottam": {
        "name": "Kazhakkoottam",
        "pincodes": [
          "695582",
          "695585"
        ]
      },
      "kilimanoor": {
        "name": "Kilimanoor",
        "pincodes": [
          "695601",
          "695604"
        ]
      },
      "kochi": {
        "name": "Kochi",
        "pincodes": [
          "682018",
          "682021",
          "682030",
          "682306",
          "682511"
        ]
      },
      "kochi,ernakulam": {
        "name": "Kochi, Ernakulam",
        "pincodes": [
          "682028"
        ]
      },
      "kochin": {
        "name": "Kochin",
        "pincodes": [
          "682024"
        ]
      },
      "kodungallur": {
        "name": "Kodungallur",
        "pincodes": [
          "680663",
          "680665",
          "680667",
          "680671",
          "680682",
          "680685"
        ]
      },
      "kolayadhub": {
        "name": "Kolayadhub",
        "pincodes": [
          "670651"
        ]
      },
      "kollakadavu": {
        "name": "Kollakadavu",
        "pincodes": [
          "690509"
        ]
      },
      "kollam": {
        "name": "Kollam",
        "pincodes": [
          "689695",
          "690573",
          "691001",
          "691003",
          "691005",
          "691006",
          "691007",
          "691008",
          "691012",
          "691013",
          "691020",
          "691304",
          "691310",
          "691501",
          "691504",
          "691505",
          "691531",
          "691532",
          "691535",
          "691543",
          "691576",
          "691581",
          "691583",
          "691584",
          "691589",
          "691601"
        ]
      },
      "kondotty": {
        "name": "Kondotty",
        "pincodes": [
          "673638"
        ]
      },
      "koothattukulam": {
        "name": "Koothattukulam",
        "pincodes": [
          "686662",
          "686663"
        ]
      },
      "koppam": {
        "name": "Ko P Pam",
        "pincodes": [
          "679307"
        ]
      },
      "kothamangalam": {
        "name": "Kothamangalam",
        "pincodes": [
          "686691",
          "686692"
        ]
      },
      "kothanalloor": {
        "name": "Kothanalloor",
        "pincodes": [
          "686562",
          "686602",
          "686633"
        ]
      },
      "kottarakkara": {
        "name": "Kottarakkara",
        "pincodes": [
          "691507",
          "691508",
          "691509",
          "691512"
        ]
      },
      "kottarakkarakollamdist": {
        "name": "Kottarakkarakollam Dist",
        "pincodes": [
          "691506"
        ]
      },
      "kottayam": {
        "name": "Kottayam",
        "pincodes": [
          "686001",
          "686004",
          "686008",
          "686011",
          "686016",
          "686017",
          "686144",
          "686504",
          "686533",
          "686601",
          "686602",
          "686604",
          "686612",
          "686613",
          "686631"
        ]
      },
      "koyilandy": {
        "name": "Koyilandy",
        "pincodes": [
          "673304"
        ]
      },
      "kozhenchery": {
        "name": "Kozhenchery",
        "pincodes": [
          "689641",
          "689654"
        ]
      },
      "kozhikode": {
        "name": "Kozhikode",
        "pincodes": [
          "673001",
          "673005",
          "673008",
          "673010",
          "673012",
          "673016",
          "673017",
          "673018",
          "673021",
          "673032",
          "673303",
          "673582",
          "673601",
          "673613",
          "673634",
          "673638"
        ]
      },
      "kundoor": {
        "name": "Kundoor",
        "pincodes": [
          "676320"
        ]
      },
      "kunnamkulam": {
        "name": "Kunnamkulam",
        "pincodes": [
          "679536",
          "679562",
          "679563",
          "680503",
          "680505",
          "680517",
          "680523",
          "680584",
          "680604"
        ]
      },
      "kunnappalli": {
        "name": "Kunnappalli",
        "pincodes": [
          "679322"
        ]
      },
      "kunnathunad": {
        "name": "Kunnathunad",
        "pincodes": [
          "682303",
          "682308",
          "683556",
          "683565"
        ]
      },
      "kuravilangad": {
        "name": "Kuravilangad",
        "pincodes": [
          "686633"
        ]
      },
      "mahadevikad": {
        "name": "Mahadevikad",
        "pincodes": [
          "690516"
        ]
      },
      "malappuram": {
        "name": "Malappuram",
        "pincodes": [
          "676317",
          "676501",
          "676504",
          "676506",
          "676507",
          "676509",
          "676517",
          "676528",
          "676552",
          "679580",
          "679584"
        ]
      },
      "malayinkeezhu": {
        "name": "Malayinkeezhu",
        "pincodes": [
          "695571"
        ]
      },
      "mananthavadi": {
        "name": "Mananthavadi",
        "pincodes": [
          "670645",
          "670721"
        ]
      },
      "mannar": {
        "name": "Mannar",
        "pincodes": [
          "689622"
        ]
      },
      "mannur": {
        "name": "Mannur",
        "pincodes": [
          "678642"
        ]
      },
      "manthuka": {
        "name": "Manthuka",
        "pincodes": [
          "689503"
        ]
      },
      "matta": {
        "name": "Matta",
        "pincodes": [
          "670702"
        ]
      },
      "mattannur": {
        "name": "Mattannur",
        "pincodes": [
          "670702"
        ]
      },
      "mavelikara": {
        "name": "Mavelikara",
        "pincodes": [
          "690101",
          "690509"
        ]
      },
      "mavilakadappuram": {
        "name": "Mavilakadappuram",
        "pincodes": [
          "671312"
        ]
      },
      "mudapalluar": {
        "name": "Mudapalluar",
        "pincodes": [
          "678684"
        ]
      },
      "mulloorkkara": {
        "name": "Mulloorkkara",
        "pincodes": [
          "680583"
        ]
      },
      "munnar": {
        "name": "Munnar",
        "pincodes": [
          "685565"
        ]
      },
      "muttuchira": {
        "name": "Muttuchira",
        "pincodes": [
          "686613"
        ]
      },
      "muvattupuzha": {
        "name": "Muvattupuzha",
        "pincodes": [
          "682311",
          "683541",
          "686669",
          "686673"
        ]
      },
      "muvattupuzhapezhakkappilly": {
        "name": "Muvattupuzha Pezhakkappilly",
        "pincodes": [
          "686673"
        ]
      },
      "mynagappally": {
        "name": "Mynagappally",
        "pincodes": [
          "690519"
        ]
      },
      "nadapuram": {
        "name": "Nadapuram",
        "pincodes": [
          "673504"
        ]
      },
      "nallepilly": {
        "name": "Nallepilly",
        "pincodes": [
          "678557"
        ]
      },
      "naranganam": {
        "name": "Naranganam",
        "pincodes": [
          "689642"
        ]
      },
      "nedumangad": {
        "name": "Nedumangad",
        "pincodes": [
          "695541",
          "695562",
          "695575"
        ]
      },
      "nenmara": {
        "name": "Nenmara",
        "pincodes": [
          "678507"
        ]
      },
      "neyyattinkara": {
        "name": "Neyyattinkara",
        "pincodes": [
          "695121",
          "695122",
          "695124",
          "695126",
          "695502",
          "695506",
          "695513"
        ]
      },
      "nilambur": {
        "name": "Nilambur",
        "pincodes": [
          "679328",
          "679332",
          "679334"
        ]
      },
      "nileswaram": {
        "name": "Nileswaram",
        "pincodes": [
          "671314"
        ]
      },
      "northparavur": {
        "name": "North Paravur",
        "pincodes": [
          "682502",
          "683511",
          "683515",
          "683517",
          "683519",
          "683520",
          "683522"
        ]
      },
      "pachalipuram": {
        "name": "Pachalipuram",
        "pincodes": [
          "680302"
        ]
      },
      "padiyottuchal": {
        "name": "Padiyottuchal",
        "pincodes": [
          "670511"
        ]
      },
      "padoor": {
        "name": "Padoor",
        "pincodes": [
          "680524"
        ]
      },
      "pala": {
        "name": "Pala",
        "pincodes": [
          "686575"
        ]
      },
      "palai": {
        "name": "Palai",
        "pincodes": [
          "686572"
        ]
      },
      "palakkad": {
        "name": "Palakkad",
        "pincodes": [
          "678006",
          "678007",
          "678013",
          "678543",
          "678556",
          "678581",
          "678623",
          "678631",
          "678731",
          "679104",
          "679501",
          "978004"
        ]
      },
      "palghat": {
        "name": "Palghat",
        "pincodes": [
          "678581"
        ]
      },
      "palluruthykoch": {
        "name": "Palluruthykoch",
        "pincodes": [
          "682006"
        ]
      },
      "pampakuda": {
        "name": "Pampakuda",
        "pincodes": [
          "686667"
        ]
      },
      "pandalam": {
        "name": "Pandalam",
        "pincodes": [
          "689501"
        ]
      },
      "pandanad": {
        "name": "Pandanad",
        "pincodes": [
          "689506"
        ]
      },
      "pandikkad": {
        "name": "Pandikkad",
        "pincodes": [
          "676521"
        ]
      },
      "para": {
        "name": "Para",
        "pincodes": [
          "678622"
        ]
      },
      "parakkadavu": {
        "name": "Parakkadavu",
        "pincodes": [
          "686508",
          "686520"
        ]
      },
      "parassala": {
        "name": "Parassala",
        "pincodes": [
          "695502"
        ]
      },
      "paravur": {
        "name": "Paravur",
        "pincodes": [
          "683516"
        ]
      },
      "parippally": {
        "name": "Parippally",
        "pincodes": [
          "691302",
          "691334",
          "691574",
          "695141",
          "695143",
          "695310",
          "695603"
        ]
      },
      "pathanamthitta": {
        "name": "Pathanamthitta",
        "pincodes": [
          "689101",
          "689514",
          "689533",
          "689548",
          "689613",
          "689645",
          "689648",
          "689656",
          "689666",
          "689667",
          "689691",
          "689692"
        ]
      },
      "pathanapuram": {
        "name": "Pathanapuram",
        "pincodes": [
          "689694"
        ]
      },
      "payyanur": {
        "name": "Payyanur",
        "pincodes": [
          "670307",
          "671311"
        ]
      },
      "pazhayannur": {
        "name": "Pazhayannur",
        "pincodes": [
          "680588"
        ]
      },
      "pazhayarikandam": {
        "name": "Pazhayarikandam",
        "pincodes": [
          "685602"
        ]
      },
      "perambra": {
        "name": "Perambra",
        "pincodes": [
          "673508",
          "673524",
          "673525"
        ]
      },
      "perinthalmanna": {
        "name": "Perinthalmanna",
        "pincodes": [
          "679321"
        ]
      },
      "perumbavoor": {
        "name": "Perumbavoor",
        "pincodes": [
          "683105",
          "683542",
          "683543",
          "683547",
          "683549",
          "683550",
          "683556"
        ]
      },
      "ponnani": {
        "name": "Ponnani",
        "pincodes": [
          "679564"
        ]
      },
      "punalur": {
        "name": "Punalur",
        "pincodes": [
          "689696",
          "691322"
        ]
      },
      "ranni": {
        "name": "Ranni",
        "pincodes": [
          "689673"
        ]
      },
      "sankaramangalam": {
        "name": "Sankaramangalam",
        "pincodes": [
          "679534"
        ]
      },
      "shoranur": {
        "name": "Shoranur",
        "pincodes": [
          "679121"
        ]
      },
      "sreenarayanapuram": {
        "name": "Sree Narayana Puram",
        "pincodes": [
          "680668"
        ]
      },
      "sultanbathery": {
        "name": "Sultan Bathery",
        "pincodes": [
          "673591",
          "673592"
        ]
      },
      "taliparamba": {
        "name": "Taliparamba",
        "pincodes": [
          "670142",
          "670334",
          "670502"
        ]
      },
      "tanur": {
        "name": "Tanur",
        "pincodes": [
          "676302"
        ]
      },
      "tatamangalam": {
        "name": "Tatamangalam",
        "pincodes": [
          "678531"
        ]
      },
      "thachanattukara": {
        "name": "Thachanattukara",
        "pincodes": [
          "678583"
        ]
      },
      "thalassery": {
        "name": "Thalassery",
        "pincodes": [
          "670662",
          "670671",
          "670694"
        ]
      },
      "thiruvananthapuram": {
        "name": "Thiruvananthapuram",
        "pincodes": [
          "695001",
          "695003",
          "695004",
          "695005",
          "695006",
          "695008",
          "695009",
          "695010",
          "695011",
          "695012",
          "695014",
          "695015",
          "695017",
          "695024",
          "695025",
          "695027",
          "695029",
          "695030",
          "695032",
          "695036",
          "695040",
          "695043",
          "695104",
          "695301",
          "695306",
          "695307",
          "695501",
          "695508",
          "695523",
          "695524",
          "695528",
          "695543",
          "695562",
          "695564",
          "695573",
          "695584",
          "695587",
          "695588",
          "695589",
          "695615"
        ]
      },
      "thiruvanathapuram": {
        "name": "Thiruvanathapuram",
        "pincodes": [
          "695043"
        ]
      },
      "thodupuzha": {
        "name": "Thodupuzha",
        "pincodes": [
          "685581",
          "685584",
          "685608"
        ]
      },
      "thrissur": {
        "name": "Thrissur",
        "pincodes": [
          "679531",
          "680003",
          "680005",
          "680012",
          "680014",
          "680020",
          "680026",
          "680028",
          "680306",
          "680308",
          "680310",
          "680541",
          "680562",
          "680563",
          "680567",
          "680569",
          "680582",
          "680590",
          "680604",
          "680613",
          "680631",
          "680651",
          "680652",
          "680655",
          "680666",
          "680683",
          "680684",
          "680722",
          "680751"
        ]
      },
      "thrithala": {
        "name": "Thrithala",
        "pincodes": [
          "679534"
        ]
      },
      "thuravoor": {
        "name": "Thuravoor",
        "pincodes": [
          "688540"
        ]
      },
      "thuruthy": {
        "name": "Thuruthy",
        "pincodes": [
          "671351"
        ]
      },
      "tirur": {
        "name": "Tirur",
        "pincodes": [
          "676103",
          "676502",
          "676510",
          "676551",
          "676561"
        ]
      },
      "tirurangadi": {
        "name": "Tirurangadi",
        "pincodes": [
          "676305",
          "676306",
          "676311"
        ]
      },
      "tiruvalla": {
        "name": "Tiruvalla",
        "pincodes": [
          "689101",
          "689105",
          "689510",
          "689546",
          "689623"
        ]
      },
      "trikaripur": {
        "name": "Trikaripur",
        "pincodes": [
          "671311"
        ]
      },
      "trisshur": {
        "name": "Trisshur",
        "pincodes": [
          "680304"
        ]
      },
      "trivandrum": {
        "name": "Trivandrum",
        "pincodes": [
          "695017",
          "695028",
          "695125",
          "695525",
          "695551",
          "695564"
        ]
      },
      "trivandrumnorth": {
        "name": "Trivandrum North",
        "pincodes": [
          "695305"
        ]
      },
      "uliyakovilpo": {
        "name": "Uliyakovil Po",
        "pincodes": [
          "691019"
        ]
      },
      "vadakara": {
        "name": "Vadakara",
        "pincodes": [
          "673542"
        ]
      },
      "vadappuram": {
        "name": "Vadappuram",
        "pincodes": [
          "676542"
        ]
      },
      "vaikom": {
        "name": "Vaikom",
        "pincodes": [
          "686141",
          "686605",
          "686607",
          "686608"
        ]
      },
      "valambur": {
        "name": "Valambur",
        "pincodes": [
          "679325"
        ]
      },
      "valanchery": {
        "name": "Valanchery",
        "pincodes": [
          "676552"
        ]
      },
      "vandanmad": {
        "name": "Vandanmad",
        "pincodes": [
          "685551"
        ]
      },
      "vanniyamblam": {
        "name": "Vanniyamblam",
        "pincodes": [
          "679339"
        ]
      },
      "venjaramoodu": {
        "name": "Venjaramoodu",
        "pincodes": [
          "695607"
        ]
      },
      "venkidangu": {
        "name": "Venkidangu",
        "pincodes": [
          "680510"
        ]
      },
      "vettathur": {
        "name": "Vettathur",
        "pincodes": [
          "679326"
        ]
      },
      "vettomcheerp": {
        "name": "Vettom Cheerp",
        "pincodes": [
          "656221"
        ]
      },
      "wadakkanchery": {
        "name": "Wadakkanchery",
        "pincodes": [
          "680596"
        ]
      },
      "wayanad": {
        "name": "Wayanad",
        "pincodes": [
          "673591"
        ]
      },
      "wayanaddt": {
        "name": "Wayanad Dt",
        "pincodes": [
          "673579"
        ]
      },
      "westvengolapominikkavala": {
        "name": "West Vengola P O Minikkavala",
        "pincodes": [
          "683556"
        ]
      }
    }
  },
  "madhyapradesh": {
    "name": "Madhya Pradesh",
    "cities": {
      "khandwa": {
        "name": "Khandwa",
        "pincodes": [
          "450001"
        ]
      },
      "rewa": {
        "name": "Rewa",
        "pincodes": [
          "486001"
        ]
      }
    }
  },
  "maharashtra": {
    "name": "Maharashtra",
    "cities": {
      "chiplun": {
        "name": "Chiplun",
        "pincodes": [
          "415605"
        ]
      },
      "gondia": {
        "name": "Gondia",
        "pincodes": [
          "441601"
        ]
      },
      "greaterthane": {
        "name": "Greater Thane",
        "pincodes": [
          "421501"
        ]
      },
      "kolhapur": {
        "name": "Kolhapur",
        "pincodes": [
          "416001"
        ]
      },
      "mumbai": {
        "name": "Mumbai",
        "pincodes": [
          "400011",
          "400017",
          "400043",
          "400051",
          "400064",
          "400080",
          "400098",
          "401208"
        ]
      },
      "nagpur": {
        "name": "Nagpur",
        "pincodes": [
          "440022"
        ]
      },
      "navimumbai": {
        "name": "Navi Mumbai",
        "pincodes": [
          "410206",
          "410210"
        ]
      },
      "pune": {
        "name": "Pune",
        "pincodes": [
          "411017",
          "411018",
          "411021",
          "411027",
          "411041"
        ]
      },
      "thane": {
        "name": "Thane",
        "pincodes": [
          "400605",
          "421203",
          "421601"
        ]
      }
    }
  },
  "odisha": {
    "name": "Odisha",
    "cities": {
      "sundergarh": {
        "name": "Sundergarh",
        "pincodes": [
          "769015"
        ]
      }
    }
  },
  "puducherry": {
    "name": "Puducherry",
    "cities": {
      "ariyankuppam": {
        "name": "Ariyankuppam",
        "pincodes": [
          "605007"
        ]
      },
      "karaikal": {
        "name": "Karaikal",
        "pincodes": [
          "609602",
          "609605",
          "609606"
        ]
      },
      "pondicherry": {
        "name": "Pondicherry",
        "pincodes": [
          "605001",
          "605004",
          "605007",
          "605008",
          "605009",
          "605010",
          "605011",
          "605013",
          "605102",
          "605104",
          "605110"
        ]
      },
      "pudhucherry": {
        "name": "Pudhucherry",
        "pincodes": [
          "605110"
        ]
      },
      "puducherry": {
        "name": "Puducherry",
        "pincodes": [
          "605005",
          "605007"
        ]
      }
    }
  },
  "punjab": {
    "name": "Punjab",
    "cities": {
      "tarntaran": {
        "name": "Tarn Taran",
        "pincodes": [
          "143419"
        ]
      }
    }
  },
  "rajasthan": {
    "name": "Rajasthan",
    "cities": {
      "ajmer": {
        "name": "Ajmer",
        "pincodes": [
          "305001"
        ]
      },
      "jodhpur": {
        "name": "Jodhpur",
        "pincodes": [
          "342008"
        ]
      }
    }
  },
  "tamilnadu": {
    "name": "Tamil Nadu",
    "cities": {
      "adirampattinam": {
        "name": "Adirampattinam",
        "pincodes": [
          "614701"
        ]
      },
      "ambasamudram": {
        "name": "Ambasamudram",
        "pincodes": [
          "627401",
          "627413",
          "627602",
          "627851"
        ]
      },
      "ambur": {
        "name": "Ambur",
        "pincodes": [
          "635751",
          "635802",
          "635813",
          "635814"
        ]
      },
      "annur": {
        "name": "Annur",
        "pincodes": [
          "638459",
          "641653"
        ]
      },
      "anthiyour": {
        "name": "Anthiyour",
        "pincodes": [
          "638301",
          "638314"
        ]
      },
      "anthiyur": {
        "name": "Anthiyur",
        "pincodes": [
          "638315"
        ]
      },
      "arakkonam": {
        "name": "Arakkonam",
        "pincodes": [
          "631002",
          "631211"
        ]
      },
      "arani": {
        "name": "Arani",
        "pincodes": [
          "606905"
        ]
      },
      "aranthangi": {
        "name": "Aranthangi",
        "pincodes": [
          "614616",
          "614801"
        ]
      },
      "ariyalur": {
        "name": "Ariyalur",
        "pincodes": [
          "621704",
          "621713"
        ]
      },
      "aruppukkottai": {
        "name": "Aruppukkottai",
        "pincodes": [
          "626101",
          "626106"
        ]
      },
      "aruppukottai": {
        "name": "Aruppukottai",
        "pincodes": [
          "626101",
          "626210"
        ]
      },
      "attur": {
        "name": "Attur",
        "pincodes": [
          "636108",
          "636119",
          "636141"
        ]
      },
      "avadi": {
        "name": "Avadi",
        "pincodes": [
          "600077",
          "602024"
        ]
      },
      "avinashi": {
        "name": "Avinashi",
        "pincodes": [
          "641652",
          "641654",
          "641666",
          "641670"
        ]
      },
      "batlagundu": {
        "name": "Batlagundu",
        "pincodes": [
          "624211"
        ]
      },
      "bhavani": {
        "name": "Bhavani",
        "pincodes": [
          "638302"
        ]
      },
      "chengalpattu": {
        "name": "Chengalpattu",
        "pincodes": [
          "600048",
          "603001",
          "603002",
          "603109",
          "603209"
        ]
      },
      "chennai": {
        "name": "Chennai",
        "pincodes": [
          "600001",
          "600002",
          "600004",
          "600005",
          "600006",
          "600010",
          "600011",
          "600012",
          "600013",
          "600014",
          "600015",
          "600016",
          "600017",
          "600018",
          "600019",
          "600020",
          "600021",
          "600023",
          "600024",
          "600026",
          "600028",
          "600029",
          "600030",
          "600031",
          "600032",
          "600033",
          "600035",
          "600037",
          "600038",
          "600039",
          "600040",
          "600041",
          "600042",
          "600043",
          "600044",
          "600045",
          "600048",
          "600049",
          "600050",
          "600051",
          "600052",
          "600053",
          "600054",
          "600055",
          "600056",
          "600057",
          "600058",
          "600059",
          "600060",
          "600061",
          "600062",
          "600063",
          "600066",
          "600068",
          "600069",
          "600071",
          "600072",
          "600073",
          "600075",
          "600076",
          "600077",
          "600078",
          "600080",
          "600081",
          "600082",
          "600083",
          "600084",
          "600087",
          "600088",
          "600089",
          "600091",
          "600092",
          "600093",
          "600094",
          "600095",
          "600096",
          "600097",
          "600099",
          "600100",
          "600101",
          "600106",
          "600107",
          "600109",
          "600110",
          "600112",
          "600114",
          "600115",
          "600116",
          "600117",
          "600118",
          "600119",
          "600122",
          "600123",
          "600124",
          "600126",
          "600127",
          "600128",
          "600129",
          "600131",
          "601102",
          "601301",
          "602002",
          "602024",
          "602025",
          "602105",
          "603102",
          "603103",
          "603112",
          "603202",
          "603209",
          "631604"
        ]
      },
      "chennaivelachery": {
        "name": "Chennai Velachery",
        "pincodes": [
          "600042"
        ]
      },
      "cherukkanur": {
        "name": "Cherukkanur",
        "pincodes": [
          "631205"
        ]
      },
      "cheyyar": {
        "name": "Cheyyar",
        "pincodes": [
          "604402",
          "604407"
        ]
      },
      "chidambaram": {
        "name": "Chidambaram",
        "pincodes": [
          "608001",
          "608002"
        ]
      },
      "chinnasalem": {
        "name": "Chinnasalem",
        "pincodes": [
          "606301"
        ]
      },
      "chrompet": {
        "name": "Chrompet",
        "pincodes": [
          "600044"
        ]
      },
      "coimbatore": {
        "name": "Coimbatore",
        "pincodes": [
          "641001",
          "641002",
          "641004",
          "641005",
          "641006",
          "641007",
          "641008",
          "641010",
          "641012",
          "641014",
          "641015",
          "641016",
          "641017",
          "641018",
          "641019",
          "641020",
          "641021",
          "641022",
          "641025",
          "641026",
          "641027",
          "641028",
          "641029",
          "641030",
          "641031",
          "641032",
          "641033",
          "641035",
          "641036",
          "641037",
          "641038",
          "641039",
          "641041",
          "641042",
          "641045",
          "641046",
          "641048",
          "641049",
          "641062",
          "641101",
          "641103",
          "641104",
          "641105",
          "641107",
          "641108",
          "641109",
          "641111",
          "641301",
          "641401",
          "641602",
          "641653",
          "641659",
          "641662",
          "641663",
          "641668"
        ]
      },
      "coonoor": {
        "name": "Coonoor",
        "pincodes": [
          "643102",
          "643231"
        ]
      },
      "cuddalore": {
        "name": "Cuddalore",
        "pincodes": [
          "607001",
          "607401",
          "608801"
        ]
      },
      "cuddaloreoldtown": {
        "name": "Cuddalore Old Town",
        "pincodes": [
          "607003"
        ]
      },
      "cumbum": {
        "name": "Cumbum",
        "pincodes": [
          "625516",
          "625521"
        ]
      },
      "devakottai": {
        "name": "Devakottai",
        "pincodes": [
          "630302"
        ]
      },
      "dharapuram": {
        "name": "Dharapuram",
        "pincodes": [
          "638656",
          "638702"
        ]
      },
      "dharmapuri": {
        "name": "Dharmapuri",
        "pincodes": [
          "635111",
          "635202",
          "635301",
          "635305",
          "636701",
          "636804",
          "636907"
        ]
      },
      "dindigul": {
        "name": "Dindigul",
        "pincodes": [
          "624001",
          "624002",
          "624003",
          "624005",
          "624304",
          "624708",
          "624802"
        ]
      },
      "ennore": {
        "name": "Ennore",
        "pincodes": [
          "600057"
        ]
      },
      "erode": {
        "name": "Erode",
        "pincodes": [
          "638001",
          "638002",
          "638004",
          "638009",
          "638011",
          "638052",
          "638107",
          "638115",
          "638116",
          "638151",
          "638183",
          "638301",
          "638315",
          "638316",
          "638452",
          "638701"
        ]
      },
      "gingee": {
        "name": "Gingee",
        "pincodes": [
          "604202"
        ]
      },
      "gobichettipalayam": {
        "name": "Gobichettipalayam",
        "pincodes": [
          "638452",
          "638453",
          "638458"
        ]
      },
      "gudiyatham": {
        "name": "Gudiyatham",
        "pincodes": [
          "632602",
          "635806"
        ]
      },
      "guduvancheri": {
        "name": "Guduvancheri",
        "pincodes": [
          "603202"
        ]
      },
      "gujiliamparai": {
        "name": "Gujiliamparai",
        "pincodes": [
          "639207"
        ]
      },
      "gummudipoondi": {
        "name": "Gummudipoondi",
        "pincodes": [
          "601201"
        ]
      },
      "harur": {
        "name": "Harur",
        "pincodes": [
          "636903"
        ]
      },
      "home": {
        "name": "Home",
        "pincodes": [
          "635654"
        ]
      },
      "hosur": {
        "name": "Hosur",
        "pincodes": [
          "635103",
          "635109",
          "635114",
          "635126"
        ]
      },
      "idappadi": {
        "name": "Idappadi",
        "pincodes": [
          "637102"
        ]
      },
      "jayankondam": {
        "name": "Jayankondam",
        "pincodes": [
          "621804"
        ]
      },
      "kalavai": {
        "name": "Kalavai",
        "pincodes": [
          "632506"
        ]
      },
      "kallakurichi": {
        "name": "Kallakurichi",
        "pincodes": [
          "606202",
          "606206"
        ]
      },
      "kancheepuram": {
        "name": "Kancheepuram",
        "pincodes": [
          "603406"
        ]
      },
      "kanchipuram": {
        "name": "Kanchipuram",
        "pincodes": [
          "600044",
          "600048",
          "600063",
          "600074",
          "600091",
          "600116",
          "600122",
          "600126",
          "600128",
          "601301",
          "603209",
          "631501",
          "631502",
          "631561",
          "631605"
        ]
      },
      "kangeyam": {
        "name": "Kangeyam",
        "pincodes": [
          "638111",
          "638701"
        ]
      },
      "kanniyakumari": {
        "name": "Kanniyakumari",
        "pincodes": [
          "629172",
          "629602",
          "629702"
        ]
      },
      "kanyakumari": {
        "name": "Kanyakumari",
        "pincodes": [
          "629001",
          "629161",
          "629175",
          "629252"
        ]
      },
      "karaikudi": {
        "name": "Karaikudi",
        "pincodes": [
          "630002",
          "630104",
          "630106",
          "630305"
        ]
      },
      "karigirivillage": {
        "name": "Karigiri Village",
        "pincodes": [
          "632106"
        ]
      },
      "karur": {
        "name": "Karur",
        "pincodes": [
          "639001",
          "639002",
          "639004",
          "639008",
          "639118"
        ]
      },
      "kavaraipettai": {
        "name": "Kavaraipettai",
        "pincodes": [
          "601206"
        ]
      },
      "kaveripattinamkrishnagiri": {
        "name": "Kaveripattinam Krishnagiri",
        "pincodes": [
          "635112"
        ]
      },
      "kayalpattinam": {
        "name": "Kayalpattinam",
        "pincodes": [
          "628204"
        ]
      },
      "kelambakkam": {
        "name": "Kelambakkam",
        "pincodes": [
          "603103"
        ]
      },
      "kodaikanal": {
        "name": "Kodaikanal",
        "pincodes": [
          "624101"
        ]
      },
      "kotagiri": {
        "name": "Kotagiri",
        "pincodes": [
          "643217"
        ]
      },
      "kovilpatti": {
        "name": "Kovilpatti",
        "pincodes": [
          "626205",
          "628552"
        ]
      },
      "krishnagiri": {
        "name": "Krishnagiri",
        "pincodes": [
          "635001",
          "635109",
          "635111",
          "635116",
          "635206"
        ]
      },
      "kulithalai": {
        "name": "Kulithalai",
        "pincodes": [
          "639104",
          "639112"
        ]
      },
      "kumbakonam": {
        "name": "Kumbakonam",
        "pincodes": [
          "612001",
          "612002",
          "612105",
          "612302",
          "612401",
          "612501",
          "612503"
        ]
      },
      "kuzhithuraipost": {
        "name": "Kuzhithurai Post",
        "pincodes": [
          "629163"
        ]
      },
      "madhurai": {
        "name": "Madhurai",
        "pincodes": [
          "625016"
        ]
      },
      "madukkur": {
        "name": "Madukkur",
        "pincodes": [
          "614903"
        ]
      },
      "madurai": {
        "name": "Madurai",
        "pincodes": [
          "625001",
          "625002",
          "625003",
          "625004",
          "625005",
          "625006",
          "625007",
          "625008",
          "625009",
          "625012",
          "625014",
          "625016",
          "625017",
          "625018",
          "625019",
          "625020",
          "625107",
          "625109",
          "625234",
          "625706",
          "628014"
        ]
      },
      "manamelkudi": {
        "name": "Manamelkudi",
        "pincodes": [
          "614620"
        ]
      },
      "manapparai": {
        "name": "Manapparai",
        "pincodes": [
          "621306",
          "621316"
        ]
      },
      "mannargudi": {
        "name": "Mannargudi",
        "pincodes": [
          "614001",
          "614015",
          "614103"
        ]
      },
      "mannarguditaulka": {
        "name": "Mannargudi Taulka",
        "pincodes": [
          "614017"
        ]
      },
      "marthandam": {
        "name": "Marthandam",
        "pincodes": [
          "629153",
          "629160",
          "629161",
          "629163",
          "629176",
          "629179",
          "629193"
        ]
      },
      "mayiladuthurai": {
        "name": "Mayiladuthurai",
        "pincodes": [
          "609301"
        ]
      },
      "melmaruvathur": {
        "name": "Melmaruvathur",
        "pincodes": [
          "603319"
        ]
      },
      "melur": {
        "name": "Melur",
        "pincodes": [
          "625106",
          "625109"
        ]
      },
      "mettupalayam": {
        "name": "Mettupalayam",
        "pincodes": [
          "641104",
          "641301",
          "641302",
          "641305"
        ]
      },
      "mettur": {
        "name": "Mettur",
        "pincodes": [
          "636402"
        ]
      },
      "musiri": {
        "name": "Musiri",
        "pincodes": [
          "621211"
        ]
      },
      "muthukulathur": {
        "name": "Muthukulathur",
        "pincodes": [
          "623601",
          "623711"
        ]
      },
      "nagapattinam": {
        "name": "Nagapattinam",
        "pincodes": [
          "611001",
          "611002",
          "611111"
        ]
      },
      "nagercoil": {
        "name": "Nagercoil",
        "pincodes": [
          "629001",
          "629002",
          "629004",
          "629202",
          "629301",
          "629402",
          "629501",
          "629701",
          "629702",
          "629852"
        ]
      },
      "nainarpalayam": {
        "name": "Nainarpalayam",
        "pincodes": [
          "606301"
        ]
      },
      "namakkal": {
        "name": "Namakkal",
        "pincodes": [
          "637001",
          "637002",
          "637015",
          "637017",
          "637020",
          "637408",
          "638183"
        ]
      },
      "nanguneri": {
        "name": "Nanguneri",
        "pincodes": [
          "627108"
        ]
      },
      "needamangalam": {
        "name": "Needamangalam",
        "pincodes": [
          "614404"
        ]
      },
      "nehrunagarhasthinapuramchrompetchennai": {
        "name": "Nehru Nagar Hasthinapuram Chrompet Chennai",
        "pincodes": [
          "600044"
        ]
      },
      "neyveli": {
        "name": "Neyveli",
        "pincodes": [
          "607801",
          "607802",
          "607805"
        ]
      },
      "nilgiris": {
        "name": "Nilgiris",
        "pincodes": [
          "643001"
        ]
      },
      "nithravilai": {
        "name": "Nithravilai",
        "pincodes": [
          "629176"
        ]
      },
      "oddanchatram": {
        "name": "Oddanchatram",
        "pincodes": [
          "624616",
          "624619",
          "624622",
          "624710"
        ]
      },
      "ooty": {
        "name": "Ooty",
        "pincodes": [
          "643001",
          "643203"
        ]
      },
      "palacode": {
        "name": "Palacode",
        "pincodes": [
          "636806"
        ]
      },
      "palani": {
        "name": "Palani",
        "pincodes": [
          "624601"
        ]
      },
      "palayamkottai": {
        "name": "Palayamkottai",
        "pincodes": [
          "627011"
        ]
      },
      "palladam": {
        "name": "Palladam",
        "pincodes": [
          "641664"
        ]
      },
      "pandhanallur": {
        "name": "Pandhanallur",
        "pincodes": [
          "609807"
        ]
      },
      "paramakudi": {
        "name": "Paramakudi",
        "pincodes": [
          "630702"
        ]
      },
      "pattukkottai": {
        "name": "Pattukkottai",
        "pincodes": [
          "614602",
          "614701"
        ]
      },
      "pennadam": {
        "name": "Pennadam",
        "pincodes": [
          "606105",
          "606106"
        ]
      },
      "pennagaram": {
        "name": "Pennagaram",
        "pincodes": [
          "636810"
        ]
      },
      "peraiyurmaduraidistrict": {
        "name": "Peraiyur Madurai District",
        "pincodes": [
          "625703"
        ]
      },
      "perambalur": {
        "name": "Perambalur",
        "pincodes": [
          "621103",
          "621115",
          "621116",
          "621117",
          "621212"
        ]
      },
      "perumanallur": {
        "name": "Perumanallur",
        "pincodes": [
          "641666"
        ]
      },
      "perunali": {
        "name": "Perunali",
        "pincodes": [
          "623120",
          "623135"
        ]
      },
      "perundurai": {
        "name": "Perundurai",
        "pincodes": [
          "638052",
          "638112"
        ]
      },
      "pochampalli": {
        "name": "Pochampalli",
        "pincodes": [
          "635206"
        ]
      },
      "pollachi": {
        "name": "Pollachi",
        "pincodes": [
          "642005",
          "642006",
          "642007"
        ]
      },
      "polur": {
        "name": "Polur",
        "pincodes": [
          "606803"
        ]
      },
      "ponnamaravathi": {
        "name": "Ponnamaravathi",
        "pincodes": [
          "630211"
        ]
      },
      "ponneri": {
        "name": "Ponneri",
        "pincodes": [
          "601204"
        ]
      },
      "poonamallee": {
        "name": "Poonamallee",
        "pincodes": [
          "600062"
        ]
      },
      "prathabaramapuram": {
        "name": "Prathabaramapuram",
        "pincodes": [
          "611111"
        ]
      },
      "pudukkottai": {
        "name": "Pudukkottai",
        "pincodes": [
          "614616",
          "614630",
          "622001",
          "622004"
        ]
      },
      "puliyal": {
        "name": "Puliyal",
        "pincodes": [
          "630312"
        ]
      },
      "punjaipuliampatti": {
        "name": "Punjai Puliampatti",
        "pincodes": [
          "638459"
        ]
      },
      "rajapalayam": {
        "name": "Rajapalayam",
        "pincodes": [
          "626117"
        ]
      },
      "ramanathapuram": {
        "name": "Ramanathapuram",
        "pincodes": [
          "623502",
          "623503",
          "623504",
          "623534",
          "623537",
          "623566",
          "623711"
        ]
      },
      "ranipet": {
        "name": "Ranipet",
        "pincodes": [
          "631003",
          "632401",
          "632503",
          "632513",
          "632515"
        ]
      },
      "rasipuram": {
        "name": "Rasipuram",
        "pincodes": [
          "637408"
        ]
      },
      "rasipuramnamakka": {
        "name": "Rasipuram Namakka",
        "pincodes": [
          "637408"
        ]
      },
      "salem": {
        "name": "Salem",
        "pincodes": [
          "636001",
          "636002",
          "636003",
          "636004",
          "636005",
          "636006",
          "636007",
          "636008",
          "636009",
          "636010",
          "636012",
          "636015",
          "636016",
          "636103",
          "636110",
          "636111",
          "636115",
          "636140",
          "636201",
          "636305",
          "636306",
          "637501",
          "637502"
        ]
      },
      "sankarankovil": {
        "name": "Sankarankovil",
        "pincodes": [
          "627719",
          "627756"
        ]
      },
      "sankarapuram": {
        "name": "Sankarapuram",
        "pincodes": [
          "605702"
        ]
      },
      "sankari": {
        "name": "Sankari",
        "pincodes": [
          "637102"
        ]
      },
      "sathyamangalam": {
        "name": "Sathyamangalam",
        "pincodes": [
          "638459",
          "638503"
        ]
      },
      "sholinghur": {
        "name": "Sholinghur",
        "pincodes": [
          "631102",
          "631301",
          "631303"
        ]
      },
      "singampunari": {
        "name": "Singampunari",
        "pincodes": [
          "630502"
        ]
      },
      "sivaganga": {
        "name": "Sivaganga",
        "pincodes": [
          "630001",
          "630002",
          "630551",
          "630561",
          "630562"
        ]
      },
      "sivagangai": {
        "name": "Sivagangai",
        "pincodes": [
          "630305",
          "630561"
        ]
      },
      "sivakasi": {
        "name": "Sivakasi",
        "pincodes": [
          "626123",
          "626124",
          "626125",
          "626130",
          "626131",
          "626189",
          "626203"
        ]
      },
      "srimushnam": {
        "name": "Srimushnam",
        "pincodes": [
          "608703"
        ]
      },
      "srivilliputhur": {
        "name": "Srivilliputhur",
        "pincodes": [
          "626125"
        ]
      },
      "tambaram": {
        "name": "Tambaram",
        "pincodes": [
          "600063"
        ]
      },
      "tenkasi": {
        "name": "Tenkasi",
        "pincodes": [
          "627424",
          "627808",
          "627811",
          "627814",
          "627818",
          "627861"
        ]
      },
      "thanjavur": {
        "name": "Thanjavur",
        "pincodes": [
          "603313",
          "612001",
          "612302",
          "613001",
          "613002",
          "613004",
          "613006",
          "614601",
          "614625",
          "614804",
          "614904"
        ]
      },
      "theivaseyalpuram": {
        "name": "Theivaseyalpuram",
        "pincodes": [
          "628851"
        ]
      },
      "theni": {
        "name": "Theni",
        "pincodes": [
          "625513",
          "625531",
          "625534",
          "625579",
          "625601"
        ]
      },
      "thenpalaniodaipatti": {
        "name": "Then Palani Odaipatti",
        "pincodes": [
          "625515"
        ]
      },
      "thirukoilure": {
        "name": "Thirukoilure",
        "pincodes": [
          "605751",
          "605757",
          "605766"
        ]
      },
      "thirunelveli": {
        "name": "Thirunelveli",
        "pincodes": [
          "627002"
        ]
      },
      "thiruporur": {
        "name": "Thiruporur",
        "pincodes": [
          "603110"
        ]
      },
      "thirupuvanamsivagangadistrict": {
        "name": "Thirupuvanam Sivaganga District",
        "pincodes": [
          "630614"
        ]
      },
      "thiruvadanai": {
        "name": "Thiruvadanai",
        "pincodes": [
          "630302"
        ]
      },
      "thiruvallur": {
        "name": "Thiruvallur",
        "pincodes": [
          "602001",
          "602024"
        ]
      },
      "thiruvannamalai": {
        "name": "Thiruvannamalai",
        "pincodes": [
          "606601"
        ]
      },
      "thiruvannamalaidistrict": {
        "name": "Thiruvannamalai District",
        "pincodes": [
          "606754"
        ]
      },
      "thiruvarumavatammuthupet": {
        "name": "Thiruvaru Mavatam Muthu Pet",
        "pincodes": [
          "614704"
        ]
      },
      "thiruvarur": {
        "name": "Thiruvarur",
        "pincodes": [
          "610001",
          "612610"
        ]
      },
      "thiruvidaimaruthur": {
        "name": "Thiruvidaimaruthur",
        "pincodes": [
          "612104"
        ]
      },
      "thisayanvilai": {
        "name": "Thisayanvilai",
        "pincodes": [
          "627104"
        ]
      },
      "thoothukudi": {
        "name": "Thoothukudi",
        "pincodes": [
          "628103"
        ]
      },
      "thoppampattipirivucoimbatore": {
        "name": "Thoppampatti Pirivu Coimbatore",
        "pincodes": [
          "641017"
        ]
      },
      "thoppur": {
        "name": "Thoppur",
        "pincodes": [
          "636305"
        ]
      },
      "thuckalay": {
        "name": "Thuckalay",
        "pincodes": [
          "629202",
          "629802"
        ]
      },
      "thuraiyur": {
        "name": "Thuraiyur",
        "pincodes": [
          "621001"
        ]
      },
      "tindivanam": {
        "name": "Tindivanam",
        "pincodes": [
          "604001",
          "604306"
        ]
      },
      "tiruchendur": {
        "name": "Tiruchendur",
        "pincodes": [
          "628202",
          "628215"
        ]
      },
      "tiruchengode": {
        "name": "Tiruchengode",
        "pincodes": [
          "637205",
          "637211",
          "637214"
        ]
      },
      "tiruchi": {
        "name": "Tiruchi",
        "pincodes": [
          "620001",
          "620002",
          "620003",
          "620004",
          "620005",
          "620006",
          "620008",
          "620009",
          "620010",
          "620012",
          "620013",
          "620015",
          "620017",
          "620019",
          "620021",
          "620022",
          "620102",
          "621216"
        ]
      },
      "tiruchirapalli": {
        "name": "Tiruchirapalli",
        "pincodes": [
          "620013",
          "621009",
          "621601"
        ]
      },
      "tiruchirappalli": {
        "name": "Tiruchirappalli",
        "pincodes": [
          "620001",
          "620003",
          "620004",
          "620012",
          "620017",
          "620019",
          "621008",
          "621010"
        ]
      },
      "tirukalukundram": {
        "name": "Tirukalukundram",
        "pincodes": [
          "603104"
        ]
      },
      "tirunelveli": {
        "name": "Tirunelveli",
        "pincodes": [
          "627002",
          "627004",
          "627005",
          "627006",
          "627008",
          "627011",
          "627357",
          "627358",
          "627416"
        ]
      },
      "tirupathur": {
        "name": "Tirupathur",
        "pincodes": [
          "635601"
        ]
      },
      "tiruppattur": {
        "name": "Tiruppattur",
        "pincodes": [
          "635601",
          "635652",
          "635851"
        ]
      },
      "tiruppur": {
        "name": "Tiruppur",
        "pincodes": [
          "641602",
          "641604",
          "641607",
          "641663",
          "642126",
          "642128"
        ]
      },
      "tirupur": {
        "name": "Tirupur",
        "pincodes": [
          "641601",
          "641602",
          "641603",
          "641604",
          "641605",
          "641606",
          "641607",
          "641652",
          "641663",
          "641664",
          "641666",
          "641667",
          "641671"
        ]
      },
      "tiruttani": {
        "name": "Tiruttani",
        "pincodes": [
          "631209"
        ]
      },
      "tiruvallur": {
        "name": "Tiruvallur",
        "pincodes": [
          "600037",
          "600053",
          "600056",
          "600071",
          "600072",
          "600076",
          "600095",
          "602001",
          "602002",
          "602003",
          "631203",
          "631207",
          "631209",
          "631210"
        ]
      },
      "tiruvannamalai": {
        "name": "Tiruvannamalai",
        "pincodes": [
          "606601",
          "606604"
        ]
      },
      "tiruvarur": {
        "name": "Tiruvarur",
        "pincodes": [
          "610001",
          "610107",
          "614001",
          "614704"
        ]
      },
      "tiruvottiyur": {
        "name": "Tiruvottiyur",
        "pincodes": [
          "600019"
        ]
      },
      "town": {
        "name": "Town",
        "pincodes": [
          "611001"
        ]
      },
      "trichy": {
        "name": "Trichy",
        "pincodes": [
          "620001",
          "620009",
          "620017",
          "620101",
          "620102"
        ]
      },
      "tuticorin": {
        "name": "Tuticorin",
        "pincodes": [
          "628001",
          "628002",
          "628003",
          "628005",
          "628008",
          "628101",
          "628152",
          "628204",
          "628952"
        ]
      },
      "udumalaipettai": {
        "name": "Udumalaipettai",
        "pincodes": [
          "642128"
        ]
      },
      "usilampatti": {
        "name": "Usilampatti",
        "pincodes": [
          "625532"
        ]
      },
      "uthangarai": {
        "name": "Uthangarai",
        "pincodes": [
          "635207"
        ]
      },
      "vallioor": {
        "name": "Vallioor",
        "pincodes": [
          "627103",
          "627105",
          "627107",
          "627109",
          "627113"
        ]
      },
      "vellakovil": {
        "name": "Vellakovil",
        "pincodes": [
          "638111"
        ]
      },
      "vellore": {
        "name": "Vellore",
        "pincodes": [
          "632001",
          "632006",
          "632007",
          "632009",
          "632014",
          "632602",
          "635854"
        ]
      },
      "velur": {
        "name": "Velur",
        "pincodes": [
          "637208"
        ]
      },
      "vennandur": {
        "name": "Vennandur",
        "pincodes": [
          "637505"
        ]
      },
      "veppanthattaiperambalur": {
        "name": "Veppanthattai Perambalur",
        "pincodes": [
          "621117"
        ]
      },
      "verkilambi": {
        "name": "Verkilambi",
        "pincodes": [
          "629177"
        ]
      },
      "villupuram": {
        "name": "Villupuram",
        "pincodes": [
          "604102",
          "605401",
          "605602"
        ]
      },
      "viluppuram": {
        "name": "Viluppuram",
        "pincodes": [
          "605103",
          "605602",
          "607203"
        ]
      },
      "viralimalai": {
        "name": "Viralimalai",
        "pincodes": [
          "621316"
        ]
      },
      "virudhachalam": {
        "name": "Virudhachalam",
        "pincodes": [
          "606001"
        ]
      },
      "virudhunagar": {
        "name": "Virudhunagar",
        "pincodes": [
          "620012",
          "626101",
          "626204"
        ]
      },
      "vriddhachalam": {
        "name": "Vriddhachalam",
        "pincodes": [
          "606001"
        ]
      }
    }
  },
  "telangana": {
    "name": "Telangana",
    "cities": {
      "adilabad": {
        "name": "Adilabad",
        "pincodes": [
          "504001"
        ]
      },
      "hayathnagar": {
        "name": "Hayathnagar",
        "pincodes": [
          "501505"
        ]
      },
      "hyderaad": {
        "name": "Hyderaad",
        "pincodes": [
          "500055"
        ]
      },
      "hyderabad": {
        "name": "Hyderabad",
        "pincodes": [
          "500003",
          "500004",
          "500010",
          "500011",
          "500012",
          "500013",
          "500016",
          "500018",
          "500019",
          "500026",
          "500036",
          "500037",
          "500040",
          "500045",
          "500048",
          "500049",
          "500055",
          "500061",
          "500062",
          "500067",
          "500070",
          "500072",
          "500073",
          "500075",
          "500079",
          "500084",
          "500089",
          "500090",
          "500091",
          "500092",
          "500094",
          "502032"
        ]
      },
      "karimnagar": {
        "name": "Karim Nagar",
        "pincodes": [
          "505001"
        ]
      },
      "khammam": {
        "name": "Khammam",
        "pincodes": [
          "507002"
        ]
      },
      "manikonda": {
        "name": "Manikonda",
        "pincodes": [
          "500089"
        ]
      },
      "medak": {
        "name": "Medak",
        "pincodes": [
          "502110"
        ]
      },
      "medchal": {
        "name": "Medchal",
        "pincodes": [
          "501401"
        ]
      },
      "nallagandla": {
        "name": "Nallagandla",
        "pincodes": [
          "500019"
        ]
      },
      "newpalvoncha": {
        "name": "New Palvoncha",
        "pincodes": [
          "507115"
        ]
      },
      "nizamabad": {
        "name": "Nizamabad",
        "pincodes": [
          "503001"
        ]
      },
      "patancheru": {
        "name": "Patancheru",
        "pincodes": [
          "502319"
        ]
      },
      "ramagundam": {
        "name": "Ramagundam",
        "pincodes": [
          "505215"
        ]
      },
      "rangareddy": {
        "name": "Rangareddy",
        "pincodes": [
          "500019",
          "500090"
        ]
      },
      "sangareddy": {
        "name": "Sangareddy",
        "pincodes": [
          "502291"
        ]
      },
      "secunderabad": {
        "name": "Secunderabad",
        "pincodes": [
          "500061"
        ]
      },
      "vemulawada": {
        "name": "Vemulawada",
        "pincodes": [
          "505302"
        ]
      },
      "warangal": {
        "name": "Warangal",
        "pincodes": [
          "506371"
        ]
      }
    }
  },
  "uttarakhand": {
    "name": "Uttarakhand",
    "cities": {
      "laksar": {
        "name": "Laksar",
        "pincodes": [
          "247663"
        ]
      }
    }
  },
  "uttarpradesh": {
    "name": "Uttar Pradesh",
    "cities": {
      "kanpur": {
        "name": "Kanpur",
        "pincodes": [
          "208010"
        ]
      },
      "meerut": {
        "name": "Meerut",
        "pincodes": [
          "245206"
        ]
      },
      "noida": {
        "name": "Noida",
        "pincodes": [
          "201301",
          "201310"
        ]
      },
      "rudrapur": {
        "name": "Rudrapur",
        "pincodes": [
          "274204"
        ]
      },
      "varanasi": {
        "name": "Varanasi",
        "pincodes": [
          "221005"
        ]
      }
    }
  },
  "westbengal": {
    "name": "West Bengal",
    "cities": {
      "kolkata": {
        "name": "Kolkata",
        "pincodes": [
          "700039",
          "700059"
        ]
      },
      "purbabardhaman": {
        "name": "Purba Bardhaman",
        "pincodes": [
          "713519"
        ]
      },
      "serampore": {
        "name": "Serampore",
        "pincodes": [
          "712202"
        ]
      }
    }
  }
};

// Add missing canonical states and union territories if not present
const MISSING_STATES: { [stateKey: string]: MasterStateData } = {
  "himachalpradesh": {
    "name": "Himachal Pradesh",
    "cities": {
      "shimla": {
        "name": "Shimla",
        "pincodes": ["171001", "171002", "171003"]
      },
      "dharamshala": {
        "name": "Dharamshala",
        "pincodes": ["176215"]
      }
    }
  },
  "jammukashmir": {
    "name": "Jammu & Kashmir",
    "cities": {
      "srinagar": {
        "name": "Srinagar",
        "pincodes": ["190001", "190002", "190003"]
      },
      "jammu": {
        "name": "Jammu",
        "pincodes": ["180001", "180002"]
      }
    }
  },
  "ladakh": {
    "name": "Ladakh",
    "cities": {
      "leh": {
        "name": "Leh",
        "pincodes": ["194101"]
      }
    }
  },
  "lakshadweep": {
    "name": "Lakshadweep",
    "cities": {
      "kavaratti": {
        "name": "Kavaratti",
        "pincodes": ["682555"]
      }
    }
  },
  "manipur": {
    "name": "Manipur",
    "cities": {
      "imphal": {
        "name": "Imphal",
        "pincodes": ["795001", "795002"]
      }
    }
  },
  "meghalaya": {
    "name": "Meghalaya",
    "cities": {
      "shillong": {
        "name": "Shillong",
        "pincodes": ["793001", "793002"]
      }
    }
  },
  "mizoram": {
    "name": "Mizoram",
    "cities": {
      "aizawl": {
        "name": "Aizawl",
        "pincodes": ["796001", "796002"]
      }
    }
  },
  "nagaland": {
    "name": "Nagaland",
    "cities": {
      "kohima": {
        "name": "Kohima",
        "pincodes": ["797001", "797002"]
      }
    }
  },
  "sikkim": {
    "name": "Sikkim",
    "cities": {
      "gangtok": {
        "name": "Gangtok",
        "pincodes": ["737101", "737102"]
      }
    }
  },
  "tripura": {
    "name": "Tripura",
    "cities": {
      "agartala": {
        "name": "Agartala",
        "pincodes": ["799001", "799002"]
      }
    }
  },
  "chandigarh": {
    "name": "Chandigarh",
    "cities": {
      "chandigarh": {
        "name": "Chandigarh",
        "pincodes": ["160001", "160002", "160003", "160017", "160022"]
      }
    }
  },
  "dadranagarhavelianddamandiu": {
    "name": "Dadra & Nagar Haveli and Daman & Diu",
    "cities": {
      "silvassa": {
        "name": "Silvassa",
        "pincodes": ["396230"]
      },
      "daman": {
        "name": "Daman",
        "pincodes": ["396210"]
      }
    }
  }
};

// Merge missing states into MASTER_LOCATIONS
for (const key in MISSING_STATES) {
  if (!MASTER_LOCATIONS[key]) {
    MASTER_LOCATIONS[key] = MISSING_STATES[key];
  }
}

// Runtime reverse lookup maps
export const PINCODE_TO_LOCATION: { [pincode: string]: { stateKey: string; cityKey: string } } = {};

export function initializePincodeMap() {
  for (const stateKey in MASTER_LOCATIONS) {
    const stateData = MASTER_LOCATIONS[stateKey];
    for (const cityKey in stateData.cities) {
      const cityData = stateData.cities[cityKey];
      if (cityData.pincodes) {
        for (const pin of cityData.pincodes) {
          PINCODE_TO_LOCATION[pin] = { stateKey, cityKey };
        }
      }
    }
  }
}

// Initialize lookup map on load
initializePincodeMap();

export const CITY_ALIASES: { [rawNormalized: string]: string } = {
  "gudiyattam": "gudiyatham",
  "gudiyatam": "gudiyatham",
  "erod": "erode",
  "bangalore": "bangalore",
  "bengaluru": "bengaluru"
};

export const STATE_ALIASES: { [rawNormalized: string]: string } = {
  "ap": "andhrapradesh",
  "andhra": "andhrapradesh",
  "tamilnadu": "tamilnadu",
  "tn": "tamilnadu",
  "andamanandnicobarislands": "andamannicobarislands",
  "andamanandnicobar": "andamannicobarislands",
  "andamannicobar": "andamannicobarislands",
  "andaman": "andamannicobarislands",
  "jammuandkashmir": "jammukashmir",
  "jk": "jammukashmir",
  "jammu": "jammukashmir",
  "kashmir": "jammukashmir",
  "dadraandnagarhavelianddamananddiu": "dadranagarhavelianddamandiu",
  "dadranagarhavelidamandiu": "dadranagarhavelianddamandiu",
  "damananddiu": "dadranagarhavelianddamandiu",
  "damandiu": "dadranagarhavelianddamandiu"
};
