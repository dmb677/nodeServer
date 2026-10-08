module.exports = function (fortunesDBpath) {
    const express = require('express');
    const router = express.Router();
    const fortunesDB = new(require('simple-json-db'))(fortunesDBpath);

    router.get('/lookup', (req, res) => {
        const {
            name,
            month,
            day
        } = req.query;

        const fortuneID = (req.session.fortuneID) ? req.session.fortuneID : `${name}-${month}-${day}`
            .toLowerCase().replace(/\s/g, '');
        const existingFortune = fortunesDB.has(fortuneID) ? true : null;

        if (!existingFortune) {
            console.log("fortune not found, creating new fortune");
            fortunesDB.set(fortuneID, {
                name: name,
                month: month,
                day: day,
                visited: 0,
                dateCreated: new Date().toISOString(),
            });
        } else {
            //increment visited count
            const fortuneData = fortunesDB.get(fortuneID);
            fortuneData.visited++;
            fortunesDB.set(fortuneID, fortuneData);
        }

        req.session.fortuneID = fortuneID;
        return res.json({
            fortuneID
        });
        //res.render('future', { data: fortuneID });
    });




    router.get('/getFortune', (req, res) => {
        const fortuneID = req.session.fortuneID;

        if (!fortuneID) {
            return res.status(400).json({
                error: 'No fortune ID found in session'
            });
        }
        const {
            name,
            month,
            day,
            visited,
            dateCreated
        } = fortunesDB.get(fortuneID);

        //console.log(name, month, day);


        const divine = [
            "searched the cosmos and found your future",
            "consulted the stars and revealed your destiny",
            "peered into the future and seen what lies ahead",
            "looked into the crystal ball and sealed your fate",
            "asked the universe for guidance and insight"
        ];

        const deathTypes = [
            "gruesome",
            "tragic",
            "freak",
            "unfortunate",
            "unexpected",
            "sudden",
            "premature",
            "untimely",
            "comical",
            "mysterious",
            "hysterical",
        ];

        const start = [
            "I am so sorry to inform you",
            "I regret to inform you",
            "I am sorry to say",
            "I gleefully share this bad news with you",
            "I am sorry to say",
            "I feel no pleasure warning you",
            "I laughingly will say to you"
        ];

        const deathMonths = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ];

        const monthindex = deathMonths.indexOf(month);
        const deathYear = 2026 + Number(day) + Number(monthindex);

        const death = [
            "You will be walking to the grocery store, singing a song to yourself, and feeling like the whole world in in your hands. But at the moement you least expect a car will come out of nowhwere and kill you dead.",

            "On one fine morning, the wind will be blowing and the birds will be chirping. But your heart will be failing. And you will only know pain and shortness of breath. And then you will die.",

            "Oh don't you love those speedy cars? Well, you will be driving one of those. And you will be going too fast. And you will crash into a tree and die.",

            "You waited your life to go on that trip, to finally see the world. To explore and to be free. But the engine on the plane dies and you will be hurled into the ocean and drown in a sea of fire.",

            "You will be walking down the street, minding your own business. And then a guy with the gun will come out of nowhere and shoot you dead. You will be dead before you even know what hit you.",

            "All I can say is don't get on that boat. Because when you do it is the beginning of the end",

            "Some peope enjoy trains, the thrill of the ride, the speed, the power. But your train will derail and you will be crushed to death.",

            "The ground will shake and eat you up whole",

            "Your death is especially painful and gruesome, I don't even want to tell you about it. But I will say this, it involves a lot of fire and screaming.",

            "welll...This is weird. But maybe you never die. You are condemned to watch your friends get old and die all around you. But your skin still sags and hair still falls out. And you bones are brittle and your teeth fall out....But for some reason you still live. And keep on living. Alone and miserable and with a slowly decaying body.",

            "Climate change will be the end of you",

            "In kansas, a tornado will come and take you up into the sky and you will never be seen again",

            "The volcano will erupt and you will be buried in lava and ash",

            "You will be walking down the street and a meteor will fall from the sky and crush you",

            "You will be walking down the street and a sinkhole will open up and swallow you whole",

            "First your sight will fail you, then your hearing....Then slowly your taste will be gone. Then you will sit in a chair and wonder what happened. And then you will die.",

            "It will happen so fast you dont even notice",

            "You will die in a hailstorm",

            "You will die of a broken heart",

            "I wish I could tell you something positive, but I can't. There will be screaming. And there will be pain. And there will be steal and the crushing of bones....There is nothing more to say",
        ];


        const output = {
            name: name,
            divine: divine[day % divine.length],
            intro: start[day % start.length],
            deathType: deathTypes[(day + monthindex) % deathTypes.length],
            deathMonth: deathMonths[(monthindex + 7) % deathMonths.length],
            deathYear: deathYear,
            death: death[day % death.length],
            visited: visited,
            dateCreated: dateCreated
        };
        res.json(output);
    });


    return router;
};