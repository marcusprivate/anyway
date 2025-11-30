const agendaData = [
    {
        "date": "17 januari 2027",
        "location": "Haarlem",
        "event": "Huiskamerfestival"
    },
    
    {
        "date": "29 mei 2026",
        "location": "Castricum",
        "event": "Besloten optreden bij Vrouwen Contact Castricum"
    },
    {
        "date": "22, 23 en 24 mei 2026",
        "location": "Den Hoorn",
        "event": "Huiskamerfestival Broadway Den Hoorn"
    },
    {
        "date": "20 december 2025",
        "location": "Amersfoort",
        "event": "Besloten optreden"
    },
    {
        "date": "20 december 2025",
        "location": "Castricum",
        "event": "Candle Light Shopping"
    },
    {
        "date": "16 december 2025",
        "location": "Texel",
        "event": "Alzheimer Wintercafé"
    },
    {
        "date": "12 april 2025",
        "location": "Castricum",
        "event": "Privé optreden voor de verjaardag van onze zangjuf"
    },

    {
        "date": "14 mei 2026",
        "location": "Texel",
        "event": "Buitengewoon Texel"
    },
    {
        "date": "2 november 2025",
        "location": "Drachten",
        "event": "A capella festival in de Lawei"
    },
    {
        "date": "14 september 2025",
        "location": "Castricum",
        "event": "Tuinenfestival"
    },
    {
        "date": "5 juli 2025",
        "location": "Haarlem",
        "event": "2 optredens tijdens de Big Sing"
    },
    {
        "date": "29 mei 2025",
        "location": "Texel",
        "event": "Dubbel optreden met koor Vokaal Kabaal uit Castricum"
    },
    {
        "date": "29 mei 2025",
        "location": "Texel",
        "event": "Buitengewoon Texel"
    },
    {
        "date": "9 maart 2025",
        "location": "Bakkum",
        "event": "Bij Marina Pronk en Marjan Huiberts"
    },
    {
        "date": "19 januari 2025",
        "location": "Bakkum",
        "event": "Bij de Oude Keuken"
    },
    {
        "date": "21 december 2024",
        "location": "Castricum",
        "event": "Candlelight Castricum"
    },
    {
        "date": "9 november 2024",
        "location": "Rotterdam",
        "event": "Balk TOP festival in de Doelen"
    },
    {
        "date": "13 oktober 2024",
        "location": "Texel",
        "event": "Jubileum optreden 25 jaar!"
    },
    {
        "date": "27 september 2024",
        "location": "Texel",
        "event": "Zingen bij Maarten Oversier"
    },
    {
        "date": "8 september 2024",
        "location": "Castricum",
        "event": "Tuinenfestival Castricum"
    },
    {
        "date": "17 en 18 mei 2024",
        "location": "Texel",
        "event": "Huiskamerfestival Broadway Den Hoorn"
    },
    {
        "date": "23 september 2023",
        "location": "Heemstede",
        "event": "Huiskamerconcert (besloten)"
    },
    {
        "date": "14 september 2023",
        "location": "Langedijk",
        "event": "Vrouwengilde (besloten)"
    },
    {
        "date": "10 september 2023",
        "location": "Castricum",
        "event": "Tuinenfestival Castricum"
    },
    {
        "date": "10 juni 2023",
        "location": "Monnickendam",
        "event": "Korendag Monnickendam"
    },
    {
        "date": "3 juni 2023",
        "location": "Heiloo",
        "event": "Gastoptreden bij het koor sWing"
    },
    {
        "date": "15 april 2023",
        "location": "Texel",
        "event": "Prive optreden"
    },
    {
        "date": "17 december 2022",
        "location": "Castricum",
        "event": "Candle light schopping"
    },
    {
        "date": "11 september 2022",
        "location": "Castricum",
        "event": "Muziektuinen festival"
    },
    {
        "date": "25 juni 2022",
        "location": "Haarlem",
        "event": "Hofjesconcert"
    },
    {
        "date": "3,4,5 juni 2022",
        "location": "Den Hoorn",
        "event": "Huiskamerfestival Broadway Den Hoorn"
    },
    {
        "date": "5 september 2021",
        "location": "Castricum",
        "event": "Muziektuinen festival"
    },
    {
        "date": "16 juli 2021",
        "location": "Texel",
        "event": "Buitenfestival Skemere"
    },
    {
        "date": "6 september 2020",
        "location": "Amsterdam",
        "event": "Struinen in de Tuinen - afgelast wegens Corona"
    },
    {
        "date": "26 juni 2020",
        "location": "Texel",
        "event": "Buitenoptreden bij de Gollards (besloten)"
    },
    {
        "date": "6 juni 2020",
        "location": "Amsterdam",
        "event": "Cuisine Culinair (besloten)-Helaas afgelast ivm Corona"
    },
    {
        "date": "28,29,30 mei 2020",
        "location": "Texel",
        "event": "Broadway Huiskamer Festival Den Hoorn-Helaas afgelast ivm Corona"
    },
    {
        "date": "8 maart 2020",
        "location": "Castricum",
        "event": "Huiskamerconcert Han Hevel"
    },
    {
        "date": "9 februari 2020",
        "location": "Haarlem",
        "event": "Gluren bij de Buren"
    },
    {
        "date": "8 februari 2020",
        "location": "Texel",
        "event": "Cultuurnacht Oosterend"
    },
    {
        "date": "21 december 2019",
        "location": "Castricum",
        "event": "Candlelight shopping"
    },
    {
        "date": "3 november 2019",
        "location": "Castricum",
        "event": "Woonzorgcentrum De Boogaert"
    },
    {
        "date": "6 oktober 2019",
        "location": "Hoorn",
        "event": "Korenfestival Musical Popkoor BROADWAY"
    },
    {
        "date": "5 juli 2019",
        "location": "Texel",
        "event": "Huwelijksceremonie (besloten)"
    },
    {
        "date": "1 juni 2019",
        "location": "Israel",
        "event": "Verjaardagsfeest"
    },
    {
        "date": "18 mei 2019",
        "location": "Noordwijk",
        "event": "Balkfestival"
    },
    {
        "date": "8 maart 2019",
        "location": "Texel",
        "event": "(besloten) Bejaardenhuis De Gollards"
    },
    {
        "date": "20 januari 2019",
        "location": "Amsterdam",
        "event": "Korenfestival Paradiso"
    },
    {
        "date": "18 november 2018",
        "location": "Zuid Scharwoude",
        "event": "Open Podium Kooger Kerk"
    },
    {
        "date": "14 en 15 september 2018",
        "location": "Texel",
        "event": "Texel Culinair"
    },
    {
        "date": "9 september 2018",
        "location": "Zuid Scharwoude",
        "event": "Kooger Kerk"
    },
    {
        "date": "26 juli 2018",
        "location": "Texel",
        "event": "Radio Texel"
    },
    {
        "date": "15 juni 2018",
        "location": "Texel",
        "event": "Skemere"
    },
    {
        "date": "18 februari 2018",
        "location": "Texel",
        "event": "Combi optreden met Brothers-4-Tune"
    },
    {
        "date": "17 februari 2018",
        "location": "Texel",
        "event": "Texelse Cultuurnacht"
    },
    {
        "date": "3 februari 2018",
        "location": "Texel",
        "event": "Benefiet diner Tesselhuus"
    },
    {
        "date": "28 december 2017",
        "location": "Texel",
        "event": "Kerstmarkt Glazen Paleis"
    },
    {
        "date": "19 november 2017",
        "location": "Texel",
        "event": "Struun Texel"
    },
    {
        "date": "16 september 2017",
        "location": "Castricum",
        "event": "Combi met Brothers-4-Tune"
    },
    {
        "date": "9 en 10 september 2017",
        "location": "Texel",
        "event": "Texel Culinair"
    },
    {
        "date": "13 mei 2017",
        "location": "Noordwijk",
        "event": "Balk Festival"
    },
    {
        "date": "15 januari 2017",
        "location": "Castricum",
        "event": "De Oude Keuken"
    },
    {
        "date": "29 december 2016",
        "location": "Texel",
        "event": "Avondwandeling Ecomare"
    },
    {
        "date": "16 december 2016",
        "location": "Texel",
        "event": "Kerstmiddag in Den Hoorn"
    },
    {
        "date": "7 oktober 2016",
        "location": "Texel",
        "event": "met Basix en Vocal Attraction"
    },
    {
        "date": "9 en 10 september 2016",
        "location": "Texel",
        "event": "Texel Culinair"
    },
    {
        "date": "16 mei 2016",
        "location": "Amsterdam",
        "event": "Korenfestival Concertgebouw"
    },
    {
        "date": "13 mei 2016",
        "location": "Texel",
        "event": "Verpleeghuis Texel"
    },
    {
        "date": "16 januari 2016",
        "location": "Amsterdam",
        "event": "Paradiso Korendagen"
    },
    {
        "date": "27 november 2015",
        "location": "Texel",
        "event": "Skarrelen Texel"
    },
    {
        "date": "31 oktober 2015",
        "location": "Rotterdam",
        "event": "Balk Top Festival"
    },
    {
        "date": "26 september 2015",
        "location": "Den Hoorn,Texel",
        "event": "Jubileum Connexion(besloten)"
    },
    {
        "date": "13 september 2015",
        "location": "Texel",
        "event": "De Luwte (besloten)"
    },
    {
        "date": "11,12 september 2015",
        "location": "Texel",
        "event": "Texel Culinair"
    },
    {
        "date": "28 juni 2015",
        "location": "Haarlem",
        "event": "Hofjesconcerten"
    },
    {
        "date": "12 juni 2015",
        "location": "Texel",
        "event": "Hotel De Waal"
    },
    {
        "date": "12 juni 2015",
        "location": "Texel",
        "event": "Verpleeghuis"
    },
    {
        "date": "6 juni 2015",
        "location": "Hengelo",
        "event": "Amusing Hengelo"
    },
    {
        "date": "30 mei 2015",
        "location": "Amsterdam",
        "event": "Cuisine Culinaire"
    },
    {
        "date": "20 mei 2015",
        "location": "Texel",
        "event": "70 jaar bevrijding"
    },
    {
        "date": "21,22,23 november 2014",
        "location": "Texel",
        "event": "Struun Texel 2014"
    },
    {
        "date": "20 september 2014",
        "location": "Amsterdam",
        "event": "Loes en Guus, 60 jaar"
    },
    {
        "date": "6,7,8 juni 2014",
        "location": "Den Hoorn",
        "event": "Broadway Den Hoorn 2014"
    },
    {
        "date": "19 januari 2014",
        "location": "Amsterdam",
        "event": "Paradiso Korendagen"
    },
    {
        "date": "9 november 2013",
        "location": "Rotterdam",
        "event": "Balk Topfestival"
    },
    {
        "date": "8 juni 2013",
        "location": "Hengelo",
        "event": "Amusing Hengelo"
    },
    {
        "date": "25,26,27 mei 2012",
        "location": "Texel",
        "event": "Broadway Den Hoorn"
    },
    {
        "date": "15 januari 2012",
        "location": "Amsterdam",
        "event": "Paradiso Korendagen"
    },
    {
        "date": "15 mei 2011",
        "location": "Oudesluis",
        "event": "Korenfestival"
    },
    {
        "date": "13 februari 2011",
        "location": "Den Burg",
        "event": "50 jarig verjaardagsfeest (besloten)"
    },
    {
        "date": "15 januari 2011",
        "location": "Amsterdam",
        "event": "Paradiso Korendagen"
    },
    {
        "date": "6 november 2010",
        "location": "De Koog",
        "event": "Vrouwen van een Eiland"
    },
    {
        "date": "30 oktober 2010",
        "location": "Den Burg",
        "event": "ANBO beurs"
    },
    {
        "date": "26 augustus 2010",
        "location": "Hoorn",
        "event": "Theatervloot Drommedaris"
    },
    {
        "date": "6 juni 2010",
        "location": "Texel",
        "event": "Opening restaurant 'De Luwte'"
    },
    {
        "date": "21,22,23 mei 2010",
        "location": "Texel",
        "event": "Broadway Den Hoorn 2010"
    },
    {
        "date": "7 april 2010",
        "location": "Texel",
        "event": "'Met muziek op pad'"
    },
    {
        "date": "23 januari 2010",
        "location": "Amsterdam",
        "event": "Paradiso 'Korendagen"
    },
    {
        "date": "8 en 15 nov. 2009",
        "location": "Texel",
        "event": "Texels Eenakterfestival 2009"
    },
    {
        "date": "31 oktober 2009",
        "location": "Apeldoorn",
        "event": "Balk Vocal Light Top Festival"
    },
    {
        "date": "6 september 2009",
        "location": "Den Helder",
        "event": "ZomerDromen festival"
    },
    {
        "date": "23 augustus 2009",
        "location": "Texel",
        "event": "Familiefeest (besloten)"
    },
    {
        "date": "4 april 2009",
        "location": "Zaandijk",
        "event": "Opening fototentoonstelling"
    },
    {
        "date": "7 februari 2009",
        "location": "Egmond",
        "event": "60 jarig verjaardagsfeest"
    },
    {
        "date": "17 januari 2009",
        "location": "Amsterdam",
        "event": "Paradiso Korendagen"
    },
    {
        "date": "13 september 2008",
        "location": "Delft",
        "event": "50 jarig verjaardagsfeest"
    },
    {
        "date": "22 juni 2008",
        "location": "Texel",
        "event": "Midzomerschansfestival"
    },
    {
        "date": "14 juni 2008",
        "location": "Castricum",
        "event": "Totaal Vokaal acapella festival"
    },
    {
        "date": "9,10,11 mei 2008",
        "location": "Den Hoorn",
        "event": "Broadway Den Hoorn - 8x opgetreden"
    },
    {
        "date": "5 januari 2008",
        "location": "Friesland",
        "event": "50 jarig huwelijksfeest"
    },
    {
        "date": "24 december 2007",
        "location": "Texel",
        "event": "Kerstfeest Hotel Opduin"
    },
    {
        "date": "24 november 2007",
        "location": "Apeldoorn",
        "event": "Balk Vocal Light Top Festival"
    },
    {
        "date": "17 september 2007",
        "location": "Amsterdam",
        "event": "Tijdens huwelijk optreden in Carre"
    },
    {
        "date": "19 mei 2007",
        "location": "Texel",
        "event": "40 jarige verjaardag"
    },
    {
        "date": "6 januari 2007",
        "location": "Texel",
        "event": "Hotel Opduin, Galadiner tbv Tesselhuus"
    },
    {
        "date": "24 december 2006",
        "location": "Texel",
        "event": "Hotel Opduin, Kerstfeest"
    },
    {
        "date": "5 november 2006",
        "location": "Goor",
        "event": "Totaal Vokaal East Event"
    },
    {
        "date": "1 oktober 2006",
        "location": "Texel",
        "event": "Waalder koffieconcert"
    },
    {
        "date": "2,3 en 4 juni 2006",
        "location": "Texel",
        "event": "Broadway Den Hoorn- 8x opgetreden"
    },
    {
        "date": "13 mei 2006",
        "location": "Texel",
        "event": "Prive optreden, Paal 9"
    },
    {
        "date": "4 februari 2006",
        "location": "Texel",
        "event": "Prive optreden, Bloem en Bos"
    },
    {
        "date": "3 februari 2006",
        "location": "Texel",
        "event": "Opening lingeriewinkel"
    },
    {
        "date": "18 november 2005",
        "location": "Texel",
        "event": "ANBO Texel"
    },
    {
        "date": "14 augustus 2005",
        "location": "Texel",
        "event": "Klif 12 theaterrestaurant"
    },
    {
        "date": "5 juli 2005",
        "location": "Amsterdam",
        "event": "Pleintheater,Totaal Vokaal"
    },
    {
        "date": "4 juni 2005",
        "location": "Texel",
        "event": "Hotel Greenside, bedrijfsfeest"
    },
    {
        "date": "4 februari 2005",
        "location": "Texel",
        "event": "Klif 12, Open podium"
    },
    {
        "date": "24 december 2004",
        "location": "Texel",
        "event": "Hotel Opduin, kerstfees"
    },
    {
        "date": "23 juli 2004",
        "location": "Texel",
        "event": "Klif 12, Cabaret Sketch & Muziek"
    },
    {
        "date": "16 juli 2004",
        "location": "Texel",
        "event": "Klif 12, Cabaret Sketch & Muziek"
    },
    {
        "date": "3 juli 2004",
        "location": "Amsterdam",
        "event": "Pleintheater, Totaal Vokaal Festival"
    },
    {
        "date": "27 juni 2004",
        "location": "Texel",
        "event": "Klif 12, Cabaret Sketch & Muziek"
    },
    {
        "date": "28,29,30 mei 2004",
        "location": "Texel",
        "event": "Broadway Den Hoorn 2004 - 8x"
    },
    {
        "date": "14 maart 2004",
        "location": "Texel",
        "event": "Klif 12, Cabaret Sketch & Muziek"
    },
    {
        "date": "30 januari 2004",
        "location": "Texel",
        "event": "Klif 12, Cabaret Sketch & Muziek"
    },
    {
        "date": "24 januari 2004",
        "location": "Texel",
        "event": "Klif 12, Cabaret Sketch & Muziek"
    },
    {
        "date": "24 december 2003",
        "location": "Texel",
        "event": "Hotel Opduin, kerstfeest"
    },
    {
        "date": "14 augustus 2003",
        "location": "Texel",
        "event": "Klif 12, Cabaret, Sketches en Muziek"
    },
    {
        "date": "29 augustus 2002",
        "location": "Texel",
        "event": "Klif 12, Cabaret, Sketches en Muziek"
    },
    {
        "date": "17,18,19 mei 2002",
        "location": "Texel",
        "event": "Broadway Den Hoorn - 4x opgetreden"
    },
    {
        "date": "4 november 2001",
        "location": "Texel",
        "event": "Lustrumconcert Acapabel"
    },
    {
        "date": "24 juni 2001",
        "location": "Texel",
        "event": "Maartenhuis, Open dag"
    }
];