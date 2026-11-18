import {
    DocumentData,
    FirestoreDataConverter,
    QueryDocumentSnapshot,
    SnapshotOptions,
    Timestamp,
} from "firebase/firestore";

interface StoreData {
    name?: string;
    pointsRequired?: number;
    rewardDescription?: string;
    createdAt?: Timestamp | string | number;
}

export class Store {
    constructor(
        public id: string, // Firebase Auth UID
        public name: string,
        public pointsRequired: number,
        public rewardDescription: string,
        public createdAt: Date = new Date()
    ) {}

    toFirestore(): DocumentData {
        return {
            name: this.name,
            pointsRequired: this.pointsRequired,
            rewardDescription: this.rewardDescription,
            createdAt: Timestamp.fromDate(this.createdAt),
        };
    }

    static fromFirestore(
        snapshot: QueryDocumentSnapshot,
        options?: SnapshotOptions
    ): Store {
        const data = snapshot.data(options) as StoreData;
        return new Store(
            snapshot.id,
            data.name ?? "",
            data.pointsRequired ?? 10,
            data.rewardDescription ?? "",
            data.createdAt instanceof Timestamp
                ? data.createdAt.toDate()
                : new Date(data.createdAt ?? Date.now())
        );
    }
}

export const storeConverter: FirestoreDataConverter<Store> = {
    toFirestore: (store: Store) => store.toFirestore(),
    fromFirestore: (snapshot, options) => Store.fromFirestore(snapshot, options),
};
