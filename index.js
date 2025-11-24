require("dotenv").config();
const express = require("express");
const cors = require("cors");

// 1:--------------------mongodb import kora hoice
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

//2:-----------------------------------firebase token verification:
const admin = require("firebase-admin");

const serviceAccount = require("./tree-plantation-firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middleware:
app.use(cors());
app.use(express.json());

//1:-----------------------------------firebase token verification:
const verifyFireBaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: "unthorized access" });
  }
  const token = authorization.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "unthorized access" });
  }
  // console.log('before decode:',token);
  //4:-----------------------------------firebase token verification:
  //id verification: from firebase.docs--->admin--->verify id tokens:
  try {
    //     //token ke verify kore decode kore nibo:
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("inside token", decoded);

    //     //req ar vitore ame "token_email" name akti key generate kore tar vitore "decode" ar vitore theke "email" ta set kore dibo
    req.token_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorize access" });
  }
};

//2---------------------mongoDB: uri set kora holo
//uri

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bvxkl1z.mongodb.net/?appName=Cluster0`;

// 3:--------------(Create a MongoClient) with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("simple crud server is running");
});

//4:--------------------function from mongodb: (data base ar sathe server) connect korar function
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //mongodb te amr je client make kore ci,oi client ar sathe ai server ar connection make korlam ai code dea:
    // await client.connect();

    //----------------server theke data-base aa data post----------------------(start)

    //mongodb client ar sathe server ar connect ar pore,akhn data base ar client ar moddhe akti "data-base(treePlant_db)" make korbo,jekhane amr colection gulu add hobe
    const db = client.db("treePlant_db"); //ai line dea data base "treePlant_db" ai name aa akti reference make hoa,data base make korar jonno akti collection make kore,oi collection aa data "insert" korte hobe

    //abar ai "treePlant_db" data base ar moddhe akti "collection" make korbo
    const createEventsCollection = db.collection("createEvents");

    //"joinedEvent" ar data rakhar jonno data-base aa "collection" make korbo----------------------(srart)
    const joinedEventsDataCollection = db.collection("joinedEvent");
    //"joinedEvent" ar data rakhar jonno data-base aa "collection" make korbo----------------------(end)

    //1:--------"createEventsCollection" ar moddhe "create-events" ar data "post" korbo akhn:
    //3:-----------------------------------firebase token verification:
    app.post("/createEvents", verifyFireBaseToken, async (req, res) => {
      //  console.log("header is the post", req.headers);
      const newEvents = req.body;
      const result = await createEventsCollection.insertOne(newEvents);
      res.send(result);
    });
    //----------------server theke data-base aa data post--------------------------------(end)

    //1:--------data get korbo (createEventsCollection) theke-------(start)

    //2nd method:------------------
    app.get("/eventsGet", async (req, res) => {
      const { search, type } = req.query;

      let query = {}; // FIXED (you forgot this)

      if (search && search.trim() !== "") {
        query.title = { $regex: search.trim(), $options: "i" };
      }

      if (type && type.trim() !== "") {
        query.eventType = type.trim();
      }

      const result = await createEventsCollection.find(query).toArray();
      res.send(result);
    });

    //1:--------data get korbo (createEventsCollection) theke-------(end)

    //"eventDetails" page ar jonno "id" dea data "get" korbo-----------(start)
    app.get("/eventsGet/:id", async (req, res) => {
      //id receive korlam:
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await createEventsCollection.findOne(query);
      res.send(result);
    });

    //"eventDetails" page ar jonno "id" dea data "get" korbo-----------(end)

    //"joinedEvent"----------ar data data-base aa "post" kora holo---------(start)
    app.post("/joinedEvent", verifyFireBaseToken, async (req, res) => {
      //client side theke je data asbe take "joinedData" ar moddhe nea nilam
      const joinedData = req.body;

      //akhn check korbo je ai event aa already join kora ace kina:
      const existing = await joinedEventsDataCollection.findOne({
        eventId: joinedData.eventId,
        userEmail: joinedData.userEmail,
      });

      if (existing) {
        return res.send({ message: "Already Joined" });
      }

      const result = await joinedEventsDataCollection.insertOne(joinedData);
      res.send(result);
    });
    //"joinedEvent"----------ar data data-base aa "post" kora holo---------(end)

    //"joinedEvent"----------ar data data-base theke "get" kora holo---------(start)
    app.get("/joinedDataGet", verifyFireBaseToken, async (req, res) => {
      //client side theke "link" ar maddhome je user ar "email" server-side aa asbe...seta "req.query" ar moddhe pabo
      const email = req.query.email;

      //token ar email ta nibo:
      const tokenEmail = req.token_email;

      //akhn "user-email" and "token-email" same na hole "error" massage send korbo
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      //rr jodi "user-email" and "token-email" same hoa tahole data-base theke login user ar join-event data find hobe
      const events = await joinedEventsDataCollection
        .find({ userEmail: email })
        .sort({ eventDate: -1 })
        .toArray();
      res.send(events);
    });

    //"joinedEvent"----------ar data data-base theke "get" kora holo---------(end)

    //db ar "createEvents" theke only "login-user" ar "created-events" data gulu "get" korbo akhn------------(start)
    app.get("/userCreatedDataGet", verifyFireBaseToken, async (req, res) => {
      //client side theke "link" ar maddhome je user ar "email" server-side aa asbe...seta "req.query" ar moddhe pabo
      const email = req.query.email;

      //token ar email ta nibo:
      const tokenEmail = req.token_email;

      //akhn "user-email" and "token-email" same na hole "error" massage send korbo
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      //rr jodi "user-email" and "token-email" same hoa tahole data-base theke login user ar join-event data find hobe
      const events = await createEventsCollection
        .find({ email: email })
        .sort({ eventDate: -1 })
        .toArray();
      res.send(events);
    });
    //db ar "createEvents" theke only "login-user" ar "created-events" data gulu "get" korbo akhn------------(end)

    //"update" login-user ar "eventData"--------------------------(start)
    app.put("/updateEventData/:id", verifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const updatedEvent = req.body;
      //akhn "eventDate" ke object aa convert kore nibo: jodi thake:
      //   if (updatedEvent.eventDate) {
      //     updatedEvent.eventDate = new Date(
      //       updatedEvent.eventDate

      //     );
      //   }

      //token ar email nea nibo
      const tokenEmail = req.token_email;

      //akhn client side theke je "id" peyeci,ai id ar sathe data-base ar je data-base ar je "_id" match hobe tar full data nea asbo akhn:"event" ar moddhe
      const event = await createEventsCollection.findOne({
        _id: new ObjectId(id),
      });

      //jodi event ar moddhe kono value na paoa jai:
      if (!event) {
        return res.status(404).send({ message: "Event not found" });
      }

      //jodi event thake tahole user ar tokenEmail(jeta fire-base theke paoa gece..authentication korar pore,user ar email dea) ar sathe "event" ar vitorer email ar match hoa kina ta dekhbo:
      if (event.email !== tokenEmail) {
        return res.status(403).send({ message: "Access Denied" });
      }

      //rr jodi email match kore tahole, client side ar send kora "id" dea data-base ar "_id" match kore  oi "data" ar moddhe "updatedEvent" ar data  "$set" korbo akhn:
      const result = await createEventsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedEvent }
      );

      res.send(result);
    });
    //"update" login-user ar "eventData"--------------------------(end)
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
