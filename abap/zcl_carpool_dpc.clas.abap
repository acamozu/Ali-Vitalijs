CLASS zcl_carpool_dpc DEFINITION
  PUBLIC
  INHERITING FROM /iwbep/cl_mgw_push_abs_data
  CREATE PUBLIC .

  " Data provider of the OData service ZCARPOOL_SRV (carpool / transfer planner), written by hand (no SEGW project).
  "   GET  PlanSet                       list of plans (without the document)
  "   GET  PlanSet('<id>')               one plan; 404 = not saved yet
  "   GET  PlanSet('<id>')/Persons       its people, also through $expand=Persons
  "   POST PlanSet  (plan + Persons)     save: stored only if Version is the stored one, otherwise 409
  "   DELETE PlanSet('<id>')

  PUBLIC SECTION.

    METHODS /iwbep/if_mgw_appl_srv_runtime~get_entity         REDEFINITION.
    METHODS /iwbep/if_mgw_appl_srv_runtime~get_entityset      REDEFINITION.
    METHODS /iwbep/if_mgw_appl_srv_runtime~create_deep_entity REDEFINITION.
    METHODS /iwbep/if_mgw_appl_srv_runtime~delete_entity      REDEFINITION.

  PROTECTED SECTION.

    " abstract in the base class; the service has no subscriptions
    METHODS check_subscription_authority REDEFINITION.

  PRIVATE SECTION.

    " the plan with its people, as the save request sends it (PERSONS = navigation property)
    TYPES: BEGIN OF ts_plan_deep.
             INCLUDE TYPE zcl_carpool_mpc=>ts_plan.
    TYPES:   persons TYPE zcl_carpool_mpc=>tt_person,
           END OF ts_plan_deep.

    METHODS plan_id_of
      IMPORTING it_key_tab        TYPE /iwbep/t_mgw_name_value_pair
      RETURNING VALUE(rv_plan_id) TYPE zcarpool_plan-plan_id.

    METHODS to_entity
      IMPORTING is_plan          TYPE zcarpool_plan
      RETURNING VALUE(rs_entity) TYPE zcl_carpool_mpc=>ts_plan.

    METHODS stamp_text
      IMPORTING iv_stamp       TYPE timestamp
      RETURNING VALUE(rv_text) TYPE zcl_carpool_mpc=>ts_plan-changed_at.
ENDCLASS.



CLASS zcl_carpool_dpc IMPLEMENTATION.


  METHOD check_subscription_authority.
    RAISE EXCEPTION TYPE /iwbep/cx_mgw_not_impl_exc
      EXPORTING
        textid = /iwbep/cx_mgw_not_impl_exc=>method_not_implemented
        method = 'CHECK_SUBSCRIPTION_AUTHORITY'.
  ENDMETHOD.


  METHOD plan_id_of.
    READ TABLE it_key_tab INTO DATA(ls_key) WITH KEY name = 'PlanId'.
    IF sy-subrc = 0.
      rv_plan_id = ls_key-value.
    ENDIF.
  ENDMETHOD.


  METHOD stamp_text.
    IF iv_stamp IS NOT INITIAL.
      rv_text = |{ iv_stamp }|.
    ENDIF.
  ENDMETHOD.


  METHOD to_entity.
    rs_entity-plan_id    = is_plan-plan_id.
    rs_entity-name       = is_plan-name.
    rs_entity-version    = is_plan-version.
    rs_entity-doc        = is_plan-doc.
    rs_entity-created_by = is_plan-created_by.
    rs_entity-created_at = stamp_text( is_plan-created_at ).
    rs_entity-changed_by = is_plan-changed_by.
    rs_entity-changed_at = stamp_text( is_plan-changed_at ).
  ENDMETHOD.


  METHOD /iwbep/if_mgw_appl_srv_runtime~get_entity.
    DATA ls_plan TYPE zcarpool_plan.

    IF iv_entity_set_name <> 'PlanSet'.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>business_error
          message          = 'Only PlanSet can be read by key'
          http_status_code = '400'.
    ENDIF.

    DATA(lv_plan_id) = plan_id_of( it_key_tab ).
    SELECT SINGLE * FROM zcarpool_plan INTO @ls_plan WHERE plan_id = @lv_plan_id.
    IF sy-subrc <> 0.
      " the app treats 404 as "no plan saved yet"
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>resource_not_found
          entity_type      = iv_entity_name
          http_status_code = '404'.
    ENDIF.

    copy_data_to_ref( EXPORTING is_data = to_entity( ls_plan )
                      CHANGING  cr_data = er_entity ).
  ENDMETHOD.


  METHOD /iwbep/if_mgw_appl_srv_runtime~get_entityset.
    DATA: lt_plan   TYPE zcl_carpool_mpc=>tt_plan,
          lt_person TYPE zcl_carpool_mpc=>tt_person.

    CASE iv_entity_set_name.

      WHEN 'PlanSet'.
        " list of plans, without the document
        SELECT * FROM zcarpool_plan INTO TABLE @DATA(lt_db) ORDER BY plan_id.
        LOOP AT lt_db INTO DATA(ls_db).
          CLEAR ls_db-doc.
          APPEND to_entity( ls_db ) TO lt_plan.
        ENDLOOP.
        copy_data_to_ref( EXPORTING is_data = lt_plan
                          CHANGING  cr_data = er_entityset ).

      WHEN 'PersonSet'.
        " PlanSet('<id>')/Persons and $expand=Persons: the key of the plan comes with the request
        DATA(lv_plan_id) = plan_id_of( it_key_tab ).
        IF lv_plan_id IS NOT INITIAL.
          SELECT plan_id, person_id, pos, name, car, seats, leg1, leg2, team, lang, note
            FROM zcarpool_person
            WHERE plan_id = @lv_plan_id
            ORDER BY pos, person_id
            INTO CORRESPONDING FIELDS OF TABLE @lt_person.
        ENDIF.
        copy_data_to_ref( EXPORTING is_data = lt_person
                          CHANGING  cr_data = er_entityset ).

    ENDCASE.
  ENDMETHOD.


  METHOD /iwbep/if_mgw_appl_srv_runtime~delete_entity.
    DATA(lv_plan_id) = plan_id_of( it_key_tab ).

    IF iv_entity_set_name = 'PlanSet' AND lv_plan_id IS NOT INITIAL.
      DELETE FROM zcarpool_person WHERE plan_id = @lv_plan_id.
      DELETE FROM zcarpool_plan   WHERE plan_id = @lv_plan_id.
    ENDIF.
  ENDMETHOD.


  METHOD /iwbep/if_mgw_appl_srv_runtime~create_deep_entity.
    DATA: ls_deep    TYPE ts_plan_deep,
          ls_plan    TYPE zcarpool_plan,
          ls_old     TYPE zcarpool_plan,
          lt_person  TYPE STANDARD TABLE OF zcarpool_person WITH DEFAULT KEY,
          ls_person  TYPE zcarpool_person,
          lv_exists  TYPE abap_bool,
          lv_varkey  TYPE rstable-varkey,
          lv_message TYPE bapi_msg.

    io_data_provider->read_entry_data( IMPORTING es_data = ls_deep ).

    IF iv_entity_set_name <> 'PlanSet' OR ls_deep-plan_id IS INITIAL.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>business_error
          message          = 'A plan with its PlanId is expected'
          http_status_code = '400'.
    ENDIF.

    " only one save of this plan at a time (the lock ends with the request)
    lv_varkey = |{ sy-mandt }{ ls_deep-plan_id }|.
    CALL FUNCTION 'ENQUEUE_E_TABLE'
      EXPORTING
        tabname        = 'ZCARPOOL_PLAN'
        varkey         = lv_varkey
      EXCEPTIONS
        foreign_lock   = 1
        system_failure = 2
        OTHERS         = 3.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>business_error
          message          = 'The plan is being saved by someone else'
          http_status_code = '409'.
    ENDIF.

    SELECT SINGLE * FROM zcarpool_plan INTO @ls_old WHERE plan_id = @ls_deep-plan_id.
    lv_exists = xsdbool( sy-subrc = 0 ).

    " the sender must have the version that is stored: otherwise somebody else saved in between
    IF lv_exists = abap_true AND ls_old-version <> ls_deep-version.
      lv_message = |Plan was changed by { ls_old-changed_by } (version { ls_old-version })|.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          textid           = /iwbep/cx_mgw_busi_exception=>business_error
          message          = lv_message
          http_status_code = '409'.
    ENDIF.

    ls_plan-mandt   = sy-mandt.
    ls_plan-plan_id = ls_deep-plan_id.
    ls_plan-name    = ls_deep-name.
    ls_plan-doc     = ls_deep-doc.
    ls_plan-version = ls_old-version + 1.
    GET TIME STAMP FIELD ls_plan-changed_at.
    ls_plan-changed_by = sy-uname.
    IF lv_exists = abap_true.
      ls_plan-created_by = ls_old-created_by.
      ls_plan-created_at = ls_old-created_at.
    ELSE.
      ls_plan-created_by = sy-uname.
      ls_plan-created_at = ls_plan-changed_at.
    ENDIF.

    LOOP AT ls_deep-persons INTO DATA(ls_in) WHERE person_id IS NOT INITIAL.
      CLEAR ls_person.
      MOVE-CORRESPONDING ls_in TO ls_person.
      ls_person-mandt   = sy-mandt.
      ls_person-plan_id = ls_plan-plan_id.
      APPEND ls_person TO lt_person.
    ENDLOOP.

    " the list replaces the stored one
    DELETE FROM zcarpool_person WHERE plan_id = @ls_plan-plan_id.
    IF lt_person IS NOT INITIAL.
      INSERT zcarpool_person FROM TABLE @lt_person ACCEPTING DUPLICATE KEYS.
    ENDIF.
    MODIFY zcarpool_plan FROM @ls_plan.

    " answer: the plan as stored (new version, who and when); document and people are not sent back
    CLEAR ls_deep.
    MOVE-CORRESPONDING to_entity( ls_plan ) TO ls_deep.
    CLEAR ls_deep-doc.
    copy_data_to_ref( EXPORTING is_data = ls_deep
                      CHANGING  cr_data = er_deep_entity ).
  ENDMETHOD.
ENDCLASS.
