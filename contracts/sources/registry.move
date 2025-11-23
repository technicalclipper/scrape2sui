module ai_paywall::registry {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use ai_paywall::paywall::{
        AccessPass,
        get_access_pass_domain,
        get_access_pass_resource,
        get_access_pass_remaining,
        get_access_pass_expiry,
    };

    // ==================== Error Codes ====================
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_RESOURCE_NOT_FOUND: u64 = 2;
    const E_INVALID_DOMAIN: u64 = 6;
    const E_RESOURCE_ALREADY_EXISTS: u64 = 7;
    const E_INVALID_PRICE: u64 = 8;
    const E_NO_ACCESS: u64 = 9; // For seal_approve

    // ==================== Structs ====================

    /// Main registry that stores all resource mappings
    public struct Registry has key {
        id: UID,
        /// Maps domain -> resource path -> ResourceEntry ID
        resources: Table<String, Table<String, ID>>,
        admin: address,
        /// Platform fee percentage (basis points, e.g., 250 = 2.5%)
        platform_fee_bps: u64,
        treasury: address,
    }

    /// Individual resource entry with pricing and metadata
    public struct ResourceEntry has key, store {
        id: UID,
        domain: String,
        resource: String,
        walrus_cid: String,
        seal_policy: String,  // Hex string representation of policy ID
        seal_policy_bytes: vector<u8>,  // Policy ID as bytes (for seal_approve comparison)
        price: u64,  // Price in MIST (1 SUI = 10^9 MIST)
        receiver: address,  // Content owner who receives payment
        max_uses: u64,  // Maximum uses per pass
        validity_duration: u64,  // Validity in milliseconds
        owner: address,  // Who registered this resource
        created_at: u64,
        active: bool,
    }

    /// Admin capability for registry management
    public struct AdminCap has key, store {
        id: UID,
    }

    // ==================== Events ====================

    public struct ResourceRegistered has copy, drop {
        resource_id: ID,
        domain: String,
        resource: String,
        walrus_cid: String,
        price: u64,
        owner: address,
    }

    public struct ResourceUpdated has copy, drop {
        resource_id: ID,
        domain: String,
        resource: String,
        updated_by: address,
    }

    public struct ResourceDeactivated has copy, drop {
        resource_id: ID,
        domain: String,
        resource: String,
    }

    public struct ResourceActivated has copy, drop {
        resource_id: ID,
        domain: String,
        resource: String,
    }

    // ==================== Initialization ====================

    /// Initialize the registry (called once on deployment)
    fun init(ctx: &mut TxContext) {
        let admin = tx_context::sender(ctx);
        
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        // Create registry
        let registry = Registry {
            id: object::new(ctx),
            resources: table::new(ctx),
            admin,
            platform_fee_bps: 250,  // 2.5% default platform fee
            treasury: admin,
        };

        transfer::transfer(admin_cap, admin);
        transfer::share_object(registry);
    }

    // ==================== Resource Management ====================

    /// Register a new protected resource
    public entry fun register_resource(
        registry: &mut Registry,
        domain: String,
        resource: String,
        walrus_cid: String,
        seal_policy: String,
        seal_policy_bytes: vector<u8>,  // Hex-decoded policy ID bytes
        price: u64,
        receiver: address,
        max_uses: u64,
        validity_duration: u64,  // in milliseconds
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(price > 0, E_INVALID_PRICE);
        
        let sender = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        // Create resource entry
        let resource_entry = ResourceEntry {
            id: object::new(ctx),
            domain,
            resource,
            walrus_cid,
            seal_policy,
            seal_policy_bytes,  // Hex-decoded bytes from client
            price,
            receiver,
            max_uses,
            validity_duration,
            owner: sender,
            created_at: timestamp,
            active: true,
        };

        let resource_id = object::id(&resource_entry);

        // Add to registry's nested table structure
        if (!table::contains(&registry.resources, domain)) {
            table::add(&mut registry.resources, domain, table::new(ctx));
        };

        let domain_table = table::borrow_mut(&mut registry.resources, domain);
        assert!(!table::contains(domain_table, resource), E_RESOURCE_ALREADY_EXISTS);
        
        table::add(domain_table, resource, resource_id);

        // Emit event
        event::emit(ResourceRegistered {
            resource_id,
            domain,
            resource,
            walrus_cid,
            price,
            owner: sender,
        });

        // Share the resource entry
        transfer::share_object(resource_entry);
    }

    /// Update resource metadata (only owner can update)
    public entry fun update_resource(
        resource_entry: &mut ResourceEntry,
        walrus_cid: String,
        seal_policy: String,
        seal_policy_bytes: vector<u8>,  // Hex-decoded policy ID bytes
        price: u64,
        max_uses: u64,
        validity_duration: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == resource_entry.owner, E_NOT_AUTHORIZED);
        assert!(price > 0, E_INVALID_PRICE);

        resource_entry.walrus_cid = walrus_cid;
        resource_entry.seal_policy = seal_policy;
        resource_entry.seal_policy_bytes = seal_policy_bytes;  // Hex-decoded bytes from client
        resource_entry.price = price;
        resource_entry.max_uses = max_uses;
        resource_entry.validity_duration = validity_duration;

        event::emit(ResourceUpdated {
            resource_id: object::id(resource_entry),
            domain: resource_entry.domain,
            resource: resource_entry.resource,
            updated_by: sender,
        });
    }

    /// Deactivate a resource (only owner can deactivate)
    public entry fun deactivate_resource(
        resource_entry: &mut ResourceEntry,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == resource_entry.owner, E_NOT_AUTHORIZED);

        resource_entry.active = false;

        event::emit(ResourceDeactivated {
            resource_id: object::id(resource_entry),
            domain: resource_entry.domain,
            resource: resource_entry.resource,
        });
    }

    /// Reactivate a resource
    public entry fun activate_resource(
        resource_entry: &mut ResourceEntry,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == resource_entry.owner, E_NOT_AUTHORIZED);
        
        resource_entry.active = true;

        event::emit(ResourceActivated {
            resource_id: object::id(resource_entry),
            domain: resource_entry.domain,
            resource: resource_entry.resource,
        });
    }

    /// Remove a resource from registry (admin only)
    public entry fun remove_resource(
        _admin_cap: &AdminCap,
        registry: &mut Registry,
        domain: String,
        resource: String,
        _ctx: &mut TxContext
    ) {
        assert!(table::contains(&registry.resources, domain), E_RESOURCE_NOT_FOUND);
        
        let domain_table = table::borrow_mut(&mut registry.resources, domain);
        assert!(table::contains(domain_table, resource), E_RESOURCE_NOT_FOUND);
        
        let _resource_id = table::remove(domain_table, resource);
        
        // If domain table is empty, remove it
        if (table::is_empty(domain_table)) {
            let empty_table = table::remove(&mut registry.resources, domain);
            table::destroy_empty(empty_table);
        };
    }

    // ==================== Admin Functions ====================

    /// Update platform fee (admin only)
    public entry fun update_platform_fee(
        _admin_cap: &AdminCap,
        registry: &mut Registry,
        new_fee_bps: u64,
    ) {
        registry.platform_fee_bps = new_fee_bps;
    }

    /// Update treasury address (admin only)
    public entry fun update_treasury(
        _admin_cap: &AdminCap,
        registry: &mut Registry,
        new_treasury: address,
    ) {
        registry.treasury = new_treasury;
    }

    /// Transfer admin capability to new admin
    public entry fun transfer_admin(
        admin_cap: AdminCap,
        registry: &mut Registry,
        new_admin: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == registry.admin, E_NOT_AUTHORIZED);
        
        registry.admin = new_admin;
        transfer::transfer(admin_cap, new_admin);
    }

    // ==================== View Functions ====================

    /// Get resource entry details
    public fun get_resource_price(resource_entry: &ResourceEntry): u64 {
        resource_entry.price
    }

    public fun get_resource_walrus_cid(resource_entry: &ResourceEntry): String {
        resource_entry.walrus_cid
    }

    public fun get_resource_seal_policy(resource_entry: &ResourceEntry): String {
        resource_entry.seal_policy
    }

    public fun get_resource_owner(resource_entry: &ResourceEntry): address {
        resource_entry.owner
    }

    public fun get_resource_receiver(resource_entry: &ResourceEntry): address {
        resource_entry.receiver
    }

    public fun get_resource_max_uses(resource_entry: &ResourceEntry): u64 {
        resource_entry.max_uses
    }

    public fun get_resource_validity_duration(resource_entry: &ResourceEntry): u64 {
        resource_entry.validity_duration
    }

    public fun is_resource_active(resource_entry: &ResourceEntry): bool {
        resource_entry.active
    }

    /// Get registry details
    public fun get_platform_fee(registry: &Registry): u64 {
        registry.platform_fee_bps
    }

    public fun get_treasury(registry: &Registry): address {
        registry.treasury
    }

    public fun get_admin(registry: &Registry): address {
        registry.admin
    }

    /// Check if a resource exists in registry
    public fun resource_exists(
        registry: &Registry,
        domain: String,
        resource: String
    ): bool {
        if (!table::contains(&registry.resources, domain)) {
            return false
        };
        
        let domain_table = table::borrow(&registry.resources, domain);
        table::contains(domain_table, resource)
    }

    /// Get resource ID from registry
    public fun get_resource_id(
        registry: &Registry,
        domain: String,
        resource: String
    ): ID {
        assert!(table::contains(&registry.resources, domain), E_RESOURCE_NOT_FOUND);
        
        let domain_table = table::borrow(&registry.resources, domain);
        assert!(table::contains(domain_table, resource), E_RESOURCE_NOT_FOUND);
        
        *table::borrow(domain_table, resource)
    }

    // ==================== Seal Access Control ====================
    
    /// Internal function to check if AccessPass is valid for resource
    fun is_access_valid(
        id: vector<u8>,
        resource_entry: &ResourceEntry,
        access_pass: &AccessPass,
        clock: &Clock
    ): bool {
        // Check if resource is active
        if (!resource_entry.active) {
            return false
        };
        
        // Check if id matches the seal_policy_bytes
        // Note: The id parameter is the policy ID as bytes (hex-decoded)
        // seal_policy_bytes should contain the hex-decoded bytes
        if (resource_entry.seal_policy_bytes != id) {
            return false
        };
        
        // Check if AccessPass domain and resource match
        // Use public getter functions to access AccessPass fields
        let pass_domain = get_access_pass_domain(access_pass);
        let pass_resource = get_access_pass_resource(access_pass);
        if (pass_domain != resource_entry.domain || pass_resource != resource_entry.resource) {
            return false
        };
        
        // Check if AccessPass has remaining uses
        let pass_remaining = get_access_pass_remaining(access_pass);
        if (pass_remaining == 0) {
            return false
        };
        
        // Check if AccessPass has expired (expiry = 0 means no expiry)
        let current_time = clock::timestamp_ms(clock);
        let pass_expiry = get_access_pass_expiry(access_pass);
        if (pass_expiry > 0 && current_time >= pass_expiry) {
            return false
        };
        
        true
    }
    
    /// Seal approve function - verifies AccessPass for decryption key access
    /// This is called by Seal key servers to verify access before releasing decryption keys
    entry fun seal_approve(
        id: vector<u8>,
        resource_entry: &ResourceEntry,
        access_pass: &AccessPass,
        clock: &Clock
    ) {
        assert!(is_access_valid(id, resource_entry, access_pass, clock), E_NO_ACCESS);
    }

    // ==================== Testing Helper (remove in production) ====================
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
