"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";

export function LogOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/sign-in");
                    router.refresh();
                },
            },
        });
    };

    return (
        <button
            onClick={handleSignOut}
            className="inline-flex rounded-lg border border-border py-1 px-2 items-center gap-2 text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
        >
            <LogOut className="w-4 h-4" />
            Sign Out
        </button>
    )
}