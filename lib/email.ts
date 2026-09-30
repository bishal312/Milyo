import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface UnreadNotificationParams {
    toEmail: string;
    recipientName: string;
    senderName: string;
    itemTitle: string;
    messagePreview: string;
    conversationId: string;
}

export async function sendUnreadMessageEmail({
    toEmail,
    recipientName,
    senderName,
    itemTitle,
    messagePreview,
    conversationId,
}: UnreadNotificationParams) {
    const chatUrl = `${process.env.NEXT_PUBLIC_APP_URL}/chat/${conversationId}`;

    try {
        const data = await resend.emails.send({
            // from: "Milyo Lost & Found <bishalm626@gmail.com>",
            from: "Milyo Lost & Found <onboarding@resend.dev>",
            to: [toEmail],
            subject: `New message regarding: ${itemTitle}`,
            html: `
            <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px; color: #18181b;">
            <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e4e4e7;">
              <h2 style="font-size: 18px; color: #111827; margin-top: 0;">Hi ${recipientName},</h2>
              <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
                You have an unread message from <strong>${senderName}</strong> regarding <strong>"${itemTitle}"</strong>:
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; font-style: italic; color: #374151;">"${messagePreview}"</p>
              </div>

              <div style="margin-top: 24px; text-align: center;">
                <a href="${chatUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold; display: inline-block;">
                  View & Reply to Message
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #f4f4f5; margin: 24px 0 12px 0;" />
              <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
                NepaliPool • Lost & Found Platform
              </p>
            </div>
          </body>
        </html>
            `
        });

        return { success: true, data };
    } catch (error) {
        console.error("Failded to send offline email alert: ", error);
        return { success: false, error };
    }
}