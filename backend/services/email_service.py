"""
Email Service — Gmail SMTP (aiosmtplib)
No domain needed. Works with any recipient email address.
Free forever (Gmail sends up to ~500 emails/day).

Setup (2 minutes):
  1. Enable 2-Step Verification on your Google account
  2. Go to https://myaccount.google.com/apppasswords
  3. Create an App Password → copy the 16-char password
  4. Add to backend/.env:
       EMAIL_HOST_USER=your.gmail@gmail.com
       EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx
"""

import os
import secrets
import logging
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
EMAIL_HOST          = os.getenv("EMAIL_HOST",          "smtp.gmail.com")
EMAIL_PORT          = int(os.getenv("EMAIL_PORT",      "587"))
EMAIL_HOST_USER     = os.getenv("EMAIL_HOST_USER",     "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_FROM_NAME     = os.getenv("EMAIL_FROM_NAME",     "OceanGuard AI")
FRONTEND_URL        = os.getenv("FRONTEND_URL",        "http://localhost:5173")
TOKEN_EXPIRY_HRS    = 24


def generate_verification_token() -> tuple[str, datetime]:
    """Generate a secure URL-safe token and its expiry timestamp."""
    token      = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HRS)
    return token, expires_at


def _build_verification_html(username: str, verify_url: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0c4a6e 0%,#0e7490 100%);
                     padding:36px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;
                         letter-spacing:-0.5px;">🌊 OceanGuard AI</span>
            <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:8px 0 0;">
              Marine Plastic Detection Platform
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;
                       color:#0f172a;letter-spacing:-0.5px;">
              Verify your email address
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Hi <strong>{username}</strong>, welcome to OceanGuard AI!<br/>
              Click the button below to verify your email and activate your account.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#0c4a6e;border-radius:10px;">
                  <a href="{verify_url}"
                     style="display:inline-block;padding:14px 32px;color:#ffffff;
                            font-size:15px;font-weight:600;text-decoration:none;">
                    Verify Email Address →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">
              Or copy this link into your browser:
            </p>
            <p style="margin:0 0 28px;font-size:12px;color:#0e7490;
                      word-break:break-all;background:#f0f9ff;
                      border-radius:8px;padding:10px 14px;">
              {verify_url}
            </p>

            <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
              <p style="margin:0;font-size:12.5px;color:#94a3b8;line-height:1.6;">
                This link expires in <strong>24 hours</strong>.<br/>
                If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;
                     border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              OceanGuard AI · HITEC University Taxila · FYP 2026
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def _send(to_email: str, subject: str, html: str) -> bool:
    """Core async SMTP sender using Gmail."""
    if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
        logger.warning(
            "EMAIL_HOST_USER / EMAIL_HOST_PASSWORD not set — "
            "skipping email send (add them to backend/.env)"
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{EMAIL_FROM_NAME} <{EMAIL_HOST_USER}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=EMAIL_HOST,
            port=EMAIL_PORT,
            username=EMAIL_HOST_USER,
            password=EMAIL_HOST_PASSWORD,
            start_tls=True,          # STARTTLS on port 587
        )
        logger.info(f"Email sent → {to_email} | subject='{subject}'")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


async def send_verification_email(to_email: str, username: str, token: str) -> bool:
    """Send the email-verification link."""
    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"

    # Always log the link so you can verify manually if email fails
    logger.info(f"🔗 VERIFY LINK for {to_email}: {verify_url}")

    html   = _build_verification_html(username, verify_url)
    result = await _send(to_email, "Verify your email — OceanGuard AI", html)

    if not result:
        logger.warning(
            f"⚠️  Email delivery failed for {to_email}. "
            f"Use the link above to verify manually."
        )
    return result

