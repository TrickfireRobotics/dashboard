import { redirect } from "next/navigation";

// The page is now the vault (API-key management is gone); keep the old path
// working for anyone with a bookmark.
export default function ApiKeysPage() {
    redirect("/vault");
}
