import {
    DocumentData,
    FirestoreDataConverter,
    QueryDocumentSnapshot,
    SnapshotOptions,
    Timestamp,
} from "firebase/firestore";

interface ClientData {
    name?: string;
    email?: string;
    createdAt?: Timestamp | string | number;
}

export class Client {
    constructor(
        public id: string, // Firebase Auth UID (encoded in the client's QR code)
        public name: string,
        public email: string,
        public createdAt: Date = new Date()
    ) {}

    toFirestore(): DocumentData {
        return {
            name: this.name,
            email: this.email,
            createdAt: Timestamp.fromDate(this.createdAt),
        };
    }

    static fromFirestore(
        snapshot: QueryDocumentSnapshot,
        options?: SnapshotOptions
    ): Client {
        const data = snapshot.data(options) as ClientData;
        return new Client(
            snapshot.id,
            data.name ?? "",
            data.email ?? "",
            data.createdAt instanceof Timestamp
                ? data.createdAt.toDate()
                : new Date(data.createdAt ?? Date.now())
        );
    }
}

export const clientConverter: FirestoreDataConverter<Client> = {
    toFirestore: (client: Client) => client.toFirestore(),
    fromFirestore: (snapshot, options) => Client.fromFirestore(snapshot, options),
};
