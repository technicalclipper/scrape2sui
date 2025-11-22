module ai_paywall::paywall;

use sui::object;
use sui::tx_context;
use sui::coin;
use sui::transfer;
use sui::event;
use sui::sui::SUI;
use std::string;

/// AccessPass - represents a paid access token for a specific domain/resource
public struct AccessPass has key, store {
    id: object::UID,
    pass_id: u64,
    owner: address,
    domain: string::String,
    resource: string::String,
    remaining: u64,
    expiry: u64,
    nonce: string::String,
    price_paid: u64,
}

/// Event emitted when a pass is purchased
public struct PassPurchased has copy, drop {
    pass_id: u64,
    owner: address,
    domain: string::String,
    resource: string::String,
    price_paid: u64,
    remaining: u64,
    expiry: u64,
    nonce: string::String,
}

/// Event emitted when a pass is consumed
public struct PassConsumed has copy, drop {
    pass_id: u64,
    remaining_after: u64,
}

/// Event emitted when pass consumption fails
public struct PassConsumptionFailed has copy, drop {
    pass_id: u64,
    reason: u8, // 1 = expired, 2 = no remaining, 3 = invalid pass
}

/// Global counter for generating unique pass IDs
public struct PassCounter has key {
    id: object::UID,
    counter: u64,
}

/// Treasury - receives payments
public struct Treasury has key {
    id: object::UID,
    treasury_address: address,
}

/// Initialize the module with a treasury and pass counter
fun init(ctx: &mut tx_context::TxContext) {
    let sender = tx_context::sender(ctx);
    let treasury = Treasury {
        id: object::new(ctx),
        treasury_address: sender, // Use deployer's address as treasury
    };
    transfer::share_object(treasury);

    let counter = PassCounter {
        id: object::new(ctx),
        counter: 0,
    };
    transfer::share_object(counter);
}

/// Generate a new unique pass ID
fun generate_pass_id(counter: &mut PassCounter): u64 {
    counter.counter = counter.counter + 1;
    counter.counter
}

/// Purchase an access pass by paying SUI
/// Returns the AccessPass object to the caller
public entry fun purchase_pass(
    payment: coin::Coin<SUI>,
    domain: vector<u8>,
    resource: vector<u8>,
    remaining: u64,
    expiry: u64,
    nonce: vector<u8>,
    treasury: &mut Treasury,
    counter: &mut PassCounter,
    ctx: &mut tx_context::TxContext,
) {
    let price = coin::value(&payment);
    assert!(price > 0, 0); // Price must be greater than 0

    // Transfer payment to treasury address
    transfer::public_transfer(coin::from_balance(coin::into_balance(payment), ctx), treasury.treasury_address);

    // Generate unique pass ID
    let pass_id = generate_pass_id(counter);
    
    let sender = tx_context::sender(ctx);
    let domain_str = string::utf8(domain);
    let resource_str = string::utf8(resource);
    let nonce_str = string::utf8(nonce);

    // Create access pass
    let pass = AccessPass {
        id: object::new(ctx),
        pass_id,
        owner: sender,
        domain: domain_str,
        resource: resource_str,
        remaining,
        expiry,
        nonce: nonce_str,
        price_paid: price,
    };

    // Emit purchase event
    event::emit(PassPurchased {
        pass_id,
        owner: sender,
        domain: domain_str,
        resource: resource_str,
        price_paid: price,
        remaining,
        expiry,
        nonce: nonce_str,
    });

    // Share the pass as a shared object so it can be mutated for multi-use
    transfer::share_object(pass);
}

/// Consume one usage from an access pass
/// Decrements remaining count, or deletes pass if remaining reaches 0
public entry fun consume_pass(
    pass: &mut AccessPass,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);
    
    // Verify ownership - only owner can consume
    assert!(pass.owner == sender, 3); // Unauthorized - not the pass owner
    
    // Check if pass has expired
    let current_time = tx_context::epoch_timestamp_ms(ctx);
    assert!(pass.expiry == 0 || current_time < pass.expiry, 1); // Pass expired

    // Check if there are remaining uses
    assert!(pass.remaining > 0, 2); // No remaining uses

    let pass_id = pass.pass_id;
    pass.remaining = pass.remaining - 1;
    let new_remaining = pass.remaining;
    
    event::emit(PassConsumed {
        pass_id,
        remaining_after: new_remaining,
    });
}

/// View function to check pass validity without consuming
public fun is_pass_valid(
    pass: &AccessPass,
    ctx: &tx_context::TxContext,
): bool {
    let current_time = tx_context::epoch_timestamp_ms(ctx);
    pass.remaining > 0 && (pass.expiry == 0 || current_time < pass.expiry)
}

/// View function to get pass details
public fun get_pass_details(pass: &AccessPass): (u64, address, string::String, string::String, u64, u64, string::String, u64) {
    (
        pass.pass_id,
        pass.owner,
        pass.domain,
        pass.resource,
        pass.remaining,
        pass.expiry,
        pass.nonce,
        pass.price_paid,
    )
}

/// View function to get remaining uses
public fun get_remaining(pass: &AccessPass): u64 {
    pass.remaining
}

/// View function to check if pass is expired
public fun is_expired(pass: &AccessPass, ctx: &tx_context::TxContext): bool {
    let current_time = tx_context::epoch_timestamp_ms(ctx);
    pass.expiry > 0 && current_time >= pass.expiry
}

