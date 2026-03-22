"""Billing endpoints — Stripe Checkout, Portal, Webhooks."""
from fastapi import APIRouter, Depends, Request, HTTPException, status
from backend.api.auth import AuthUser, get_current_user
from backend.api.db.client import get_supabase
from backend.api.services.stripe_service import (
    create_checkout_session,
    create_portal_session,
    construct_webhook_event,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.post("/checkout")
async def checkout(user: AuthUser = Depends(get_current_user)):
    """Create a Stripe Checkout session and return the redirect URL."""
    url = await create_checkout_session(user.id, user.email or "")
    return {"url": url}


@router.post("/portal")
async def portal(user: AuthUser = Depends(get_current_user)):
    """Create a Stripe Customer Portal session for managing subscription."""
    db = get_supabase()
    profile = (
        db.table("user_profile")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    customer_id = profile.data.get("stripe_customer_id") if profile.data else None
    if not customer_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active subscription found")
    url = await create_portal_session(customer_id)
    return {"url": url}


@router.post("/webhook")
async def webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    event = construct_webhook_event(payload, sig)
    db = get_supabase()

    if event.type == "checkout.session.completed":
        session = event.data.object
        user_id = session.get("metadata", {}).get("user_id")
        customer_id = session.get("customer")
        if user_id:
            db.table("user_profile").upsert({
                "user_id": user_id,
                "subscription_tier": "premium",
                "stripe_customer_id": customer_id,
            }, on_conflict="user_id").execute()

    elif event.type == "customer.subscription.deleted":
        subscription = event.data.object
        customer_id = subscription.get("customer")
        if customer_id:
            db.table("user_profile").update({
                "subscription_tier": "free",
            }).eq("stripe_customer_id", customer_id).execute()

    elif event.type == "invoice.payment_failed":
        invoice = event.data.object
        customer_id = invoice.get("customer")
        if customer_id:
            db.table("user_profile").update({
                "subscription_status": "past_due",
            }).eq("stripe_customer_id", customer_id).execute()

    return {"received": True}
