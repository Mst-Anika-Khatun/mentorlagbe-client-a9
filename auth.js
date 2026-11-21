import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { jwt } from "better-auth/plugins";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dnsPromises.setServers(["8.8.8.8", "8.8.4.4"]);

const client = new MongoClient(process.env.MONGODB_URI);

export const auth = betterAuth({
    database: mongodbAdapter(client.db("mentorlagbe_auth")),
    emailAndPassword: {
        enabled: true
    },
    plugins: [jwt()]
});