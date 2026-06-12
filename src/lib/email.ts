import { Resend } from "resend";

export async function sendEmail({
    to,
    subject,
    html,
}: {
    to: string;
    subject: string;
    html: string;
}) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to,
        subject,
        html,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
}
