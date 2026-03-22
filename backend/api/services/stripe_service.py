"""Stripe payment service — checkout, portal, webhook handling."""
import stripe
from fastapi import HTTPException, status
from backend.config import settings


def _configure_stripe():
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Stripe not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY


async def create_checkout_session(user_id: str, user_email: str) -> str:
    """Create a Stripe Checkout session for Premium subscription. Returns the checkout URL."""
    _configure_stripe()

    if not settings.STRIPE_PRICE_ID_PREMIUM:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Premium price not configured")

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": settings.STRIPE_PRICE_ID_PREMIUM, "quantity": 1}],
        customer_email=user_email,
        success_url=f"{settings.FRONTEND_URL}/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/billing?canceled=true",
        metadata={"user_id": user_id},
    )
    return session.url


async def create_portal_session(customer_id: str) -> str:
    """Create a Stripe Customer Portal session. Returns the portal URL."""
    _configure_stripe()
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.FRONTEND_URL}/billing",
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    """Verify and construct a Stripe webhook event."""
    _configure_stripe()
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhook secret not configured")
    try:
        return stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")
