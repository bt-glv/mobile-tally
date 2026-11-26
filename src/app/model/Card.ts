import {
    DocumentData,
    FirestoreDataConverter,
    QueryDocumentSnapshot,
    SnapshotOptions,
    Timestamp,
} from "firebase/firestore";

export type CardStatus = "incomplete" | "complete" | "claimed";

interface CardData {
    storeId?          : string;
    clientId?         : string;
    storeName?        : string;
    rewardDescription?: string;
    clientName?       : string;
    currentPoints?    : number;
    maxPoints?        : number;
    status?           : CardStatus;
    pointHistory?     : Array<Timestamp | string | number>;
    createdAt?        : Timestamp | string | number;
    updatedAt?        : Timestamp | string | number;
    claimedAt?        : Timestamp | string | number | null;
}

export class Card {
    constructor(
        public id               : string,
        public storeId          : string,
        public clientId         : string,
        public storeName        : string,
        public rewardDescription: string,
        public clientName       : string,
        public currentPoints    : number = 0,
        public maxPoints        : number = 10,
        public status           : CardStatus = "incomplete",
        public pointHistory     : Date[] = [],
        public createdAt        : Date = new Date(),
        public updatedAt        : Date = new Date(),
        public claimedAt        : Date | null = null
    ) {}

    get isComplete(): boolean {
        return this.status === "complete" || this.currentPoints >= this.maxPoints;
    }

    get progress(): number {
        if (this.maxPoints <= 0) return 0;
        return Math.min(1, this.currentPoints / this.maxPoints);
    }

    addPoint(timestamp: Date = new Date()): void {
        if (this.status !== "incomplete") {
            throw new Error(
                `Cannot add points to a card with status "${this.status}".`
            );
        }

        this.currentPoints += 1;
        this.pointHistory.push(timestamp);
        this.updatedAt = timestamp;

        if (this.currentPoints >= this.maxPoints) {
            this.status = "complete";
        }
    }

    claim(timestamp: Date = new Date()): void {
        if (this.status !== "complete") {
            throw new Error("Only completed cards can be claimed.");
        }

        this.status = "claimed";
        this.claimedAt = timestamp;
        this.updatedAt = timestamp;
    }

    toFirestore(): DocumentData {
        return {
            storeId: this.storeId,
            clientId: this.clientId,
            storeName: this.storeName,
            rewardDescription: this.rewardDescription,
            clientName: this.clientName,
            currentPoints: this.currentPoints,
            maxPoints: this.maxPoints,
            status: this.status,
            pointHistory: this.pointHistory.map((date) => Timestamp.fromDate(date)),
            createdAt: Timestamp.fromDate(this.createdAt),
            updatedAt: Timestamp.fromDate(this.updatedAt),
            claimedAt: this.claimedAt ? Timestamp.fromDate(this.claimedAt) : null,
        };
    }

    static fromFirestore(
        snapshot: QueryDocumentSnapshot,
        options?: SnapshotOptions
    ): Card {
        const data = snapshot.data(options) as CardData;

        const parseDate = (value: unknown): Date =>
            value instanceof Timestamp
                ? value.toDate()
                : new Date((value as string | number) ?? Date.now());

        const rawHistory = Array.isArray(data.pointHistory)
            ? data.pointHistory
            : [];

        return new Card(
            snapshot.id,
            data.storeId ?? "",
            data.clientId ?? "",
            data.storeName ?? "",
            data.rewardDescription ?? "",
            data.clientName ?? "",
            data.currentPoints ?? 0,
            data.maxPoints ?? 10,
            data.status ?? "incomplete",
            rawHistory.map(parseDate),
            parseDate(data.createdAt),
            parseDate(data.updatedAt),
            data.claimedAt ? parseDate(data.claimedAt) : null
        );
    }
}

export const cardConverter: FirestoreDataConverter<Card> = {
    toFirestore: (card: Card) => card.toFirestore(),
    fromFirestore: (snapshot, options) => Card.fromFirestore(snapshot, options),
};
