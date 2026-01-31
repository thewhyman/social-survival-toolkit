import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  try {
    // Env checks first (so failures are visible)
    const sk = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.APP_URL;

    if (!sk) return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    if (!priceId) return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    if (!appUrl) return NextResponse.json({ error: "Missing APP_URL" }, { status: 500 });

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized (not signed in)" }, { status: 401 });

    const stripe = new Stripe(sk, { apiVersion: "2026-01-28.clover" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: { clerk_user_id: userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    // Always return something
    return NextResponse.json(
      {
        error: e?.message || "Checkout failed",
        name: e?.name,
        stack: e?.stack,
      },
      { status: 500 }
    );
  }
}