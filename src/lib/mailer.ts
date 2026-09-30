import nodemailer from 'nodemailer';

// ── Transporter (lazy-initialized) ──────────────────────────
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env',
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

const FROM = process.env.FROM_EMAIL || 'CampusIQ <no-reply@campusiq.local>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ── Email: Verify account ────────────────────────────────────
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const firstName = name.split(' ')[0];

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your CampusIQ account ✅',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#f4f7ff;padding:32px 16px;">
        <div style="background:#fff;border-radius:20px;padding:36px;border:1px solid #e0e9e4;box-shadow:0 8px 40px rgba(0,53,39,0.08);">

          <!-- Logo -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="vertical-align:middle;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:40px;height:40px;background:#003527;border-radius:12px;text-align:center;vertical-align:middle;font-size:20px;line-height:40px;">🎓</td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align:middle;padding-left:12px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-weight:800;font-size:17px;color:#003527;line-height:1.3;">CampusIQ</p>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#80bea6;letter-spacing:1.5px;">SCHOLARLY INTELLIGENCE PLATFORM</p>
              </td>
            </tr>
          </table>

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0b1c30;">
            Hi ${firstName}, verify your email 👋
          </h1>
          <p style="margin:0 0 24px;color:#5a6672;font-size:14px;line-height:1.6;">
            Thanks for signing up! Click the button below to verify your email address
            and activate your CampusIQ account.
          </p>

          <a href="${link}"
             style="display:inline-block;background:#003527;color:#fff;font-weight:700;
                    font-size:14px;padding:14px 32px;border-radius:12px;
                    text-decoration:none;letter-spacing:0.3px;">
            ✅ Verify my email
          </a>

          <p style="margin:20px 0 0;color:#9ca8a3;font-size:12px;">
            This link expires in <strong>24 hours</strong>.
            If you didn't sign up for CampusIQ, you can safely ignore this email.
          </p>

          <hr style="border:none;border-top:1px solid #f0f4f0;margin:24px 0;" />
          <p style="margin:0;color:#bfc9c3;font-size:11px;text-align:center;">
            © 2026 CampusIQ · Made by Fantastic Four
          </p>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nVerify your CampusIQ account:\n${link}\n\nThis link expires in 24 hours.`,
  });
}

// ── Email: OTP for Account Verification ────────────────────────────
export async function sendSignupOTPEmail(
  email: string,
  name: string,
  otp: string,
): Promise<void> {
  const firstName = name.split(' ')[0];

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `${otp} — Verify your CampusIQ account`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#f4f7ff;padding:32px 16px;">
        <div style="background:#fff;border-radius:20px;padding:36px;border:1px solid #e0e9e4;box-shadow:0 8px 40px rgba(0,53,39,0.08);">

          <!-- Logo -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="vertical-align:middle;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:40px;height:40px;background:#003527;border-radius:12px;text-align:center;vertical-align:middle;font-size:20px;line-height:40px;">🎓</td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align:middle;padding-left:12px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-weight:800;font-size:17px;color:#003527;line-height:1.3;">CampusIQ</p>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#80bea6;letter-spacing:1.5px;">SCHOLARLY INTELLIGENCE PLATFORM</p>
              </td>
            </tr>
          </table>

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0b1c30;">
            Verify your email 👋
          </h1>
          <p style="margin:0 0 24px;color:#5a6672;font-size:14px;line-height:1.6;">
            Hi ${firstName}, thanks for signing up! Use the OTP below to activate your CampusIQ account.
            It is valid for <strong>10 minutes</strong>.
          </p>

          <!-- OTP Box -->
          <div style="background:#f0f9f6;border:2px solid #b0f0d6;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca8a3;letter-spacing:2px;text-transform:uppercase;">
              Your Verification Code
            </p>
            <p style="margin:0;font-size:40px;font-weight:900;color:#003527;letter-spacing:10px;font-family:monospace;">
              ${otp}
            </p>
          </div>

          <p style="margin:0;color:#9ca8a3;font-size:12px;">
            If you didn't sign up for CampusIQ, you can safely ignore this email.
          </p>

          <hr style="border:none;border-top:1px solid #f0f4f0;margin:24px 0;" />
          <p style="margin:0;color:#bfc9c3;font-size:11px;text-align:center;">
            © 2026 CampusIQ · Made by Fantastic Four
          </p>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nYour CampusIQ verification code is: ${otp}\n\nValid for 10 minutes.`,
  });
}

// ── Email: OTP for password reset ────────────────────────────
export async function sendOTPEmail(
  email: string,
  name: string,
  otp: string,
): Promise<void> {
  const firstName = name.split(' ')[0];

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `${otp} — Your CampusIQ password reset code`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#f4f7ff;padding:32px 16px;">
        <div style="background:#fff;border-radius:20px;padding:36px;border:1px solid #e0e9e4;box-shadow:0 8px 40px rgba(0,53,39,0.08);">

          <!-- Logo -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="vertical-align:middle;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:40px;height:40px;background:#003527;border-radius:12px;text-align:center;vertical-align:middle;font-size:20px;line-height:40px;">🎓</td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align:middle;padding-left:12px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-weight:800;font-size:17px;color:#003527;line-height:1.3;">CampusIQ</p>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#80bea6;letter-spacing:1.5px;">SCHOLARLY INTELLIGENCE PLATFORM</p>
              </td>
            </tr>
          </table>

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0b1c30;">
            Password Reset OTP 🔑
          </h1>
          <p style="margin:0 0 24px;color:#5a6672;font-size:14px;line-height:1.6;">
            Hi ${firstName}, use the OTP below to reset your password. 
            It is valid for <strong>10 minutes</strong>.
          </p>

          <!-- OTP Box -->
          <div style="background:#f0f9f6;border:2px solid #b0f0d6;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca8a3;letter-spacing:2px;text-transform:uppercase;">
              Your One-Time Password
            </p>
            <p style="margin:0;font-size:40px;font-weight:900;color:#003527;letter-spacing:10px;font-family:monospace;">
              ${otp}
            </p>
          </div>

          <p style="margin:0;color:#9ca8a3;font-size:12px;">
            ⚠️ Never share this OTP with anyone. CampusIQ staff will <strong>never</strong> ask for your OTP.
            If you didn't request a password reset, please ignore this email — your account is safe.
          </p>

          <hr style="border:none;border-top:1px solid #f0f4f0;margin:24px 0;" />
          <p style="margin:0;color:#bfc9c3;font-size:11px;text-align:center;">
            © 2026 CampusIQ · Made by Fantastic Four
          </p>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nYour CampusIQ password reset OTP is: ${otp}\n\nValid for 10 minutes. Never share this with anyone.`,
  });
}
