import { inviteAccount } from "@/lib/management/service";
import { managementMutation } from "@/lib/management/http";

export async function POST(request: Request) { return managementMutation(request, inviteAccount, true); }
