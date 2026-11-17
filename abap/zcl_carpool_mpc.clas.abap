CLASS zcl_carpool_mpc DEFINITION
  PUBLIC
  INHERITING FROM /iwbep/cl_mgw_push_abs_model
  CREATE PUBLIC .

  " Model of the OData service ZCARPOOL_SRV (carpool / transfer planner), written by hand (no SEGW project).
  "   Plan    one row of ZCARPOOL_PLAN
  "   Person  one row of ZCARPOOL_PERSON; Plan -> Persons (navigation)

  PUBLIC SECTION.

    TYPES:
      BEGIN OF ts_plan,
        plan_id    TYPE c LENGTH 20,
        name       TYPE c LENGTH 80,
        version    TYPE i,
        doc        TYPE string,
        created_by TYPE c LENGTH 12,
        created_at TYPE c LENGTH 14,   " UTC, YYYYMMDDHHMMSS
        changed_by TYPE c LENGTH 12,
        changed_at TYPE c LENGTH 14,
      END OF ts_plan,
      tt_plan TYPE STANDARD TABLE OF ts_plan WITH DEFAULT KEY,
      BEGIN OF ts_person,
        plan_id   TYPE c LENGTH 20,
        person_id TYPE c LENGTH 20,
        pos       TYPE i,
        name      TYPE c LENGTH 80,
        car       TYPE c LENGTH 1,     " 'X' = brings a car
        seats     TYPE i,
        leg1      TYPE c LENGTH 1,     " 'X' = takes part in leg 1
        leg2      TYPE c LENGTH 1,
        team      TYPE c LENGTH 40,
        lang      TYPE c LENGTH 2,
        note      TYPE c LENGTH 60,
      END OF ts_person,
      tt_person TYPE STANDARD TABLE OF ts_person WITH DEFAULT KEY.

    METHODS define REDEFINITION.

  PRIVATE SECTION.

    METHODS string_property
      IMPORTING io_entity_type TYPE REF TO /iwbep/if_mgw_odata_entity_typ
                iv_name        TYPE /iwbep/if_mgw_med_odata_types=>ty_e_med_entity_name
                iv_field       TYPE fieldname
                iv_length      TYPE i DEFAULT 0
                iv_key         TYPE abap_bool DEFAULT abap_false
      RAISING   /iwbep/cx_mgw_med_exception.

    METHODS int_property
      IMPORTING io_entity_type TYPE REF TO /iwbep/if_mgw_odata_entity_typ
                iv_name        TYPE /iwbep/if_mgw_med_odata_types=>ty_e_med_entity_name
                iv_field       TYPE fieldname
      RAISING   /iwbep/cx_mgw_med_exception.
ENDCLASS.



CLASS zcl_carpool_mpc IMPLEMENTATION.


  METHOD define.
    DATA: lo_plan   TYPE REF TO /iwbep/if_mgw_odata_entity_typ,
          lo_person TYPE REF TO /iwbep/if_mgw_odata_entity_typ,
          lo_assoc  TYPE REF TO /iwbep/if_mgw_odata_assoc.

    model->set_schema_namespace( 'ZCARPOOL_SRV' ).

    lo_plan = model->create_entity_type( iv_entity_type_name = 'Plan' iv_def_entity_set = abap_false ).
    string_property( io_entity_type = lo_plan iv_name = 'PlanId'    iv_field = 'PLAN_ID'    iv_length = 20 iv_key = abap_true ).
    string_property( io_entity_type = lo_plan iv_name = 'Name'      iv_field = 'NAME'       iv_length = 80 ).
    int_property(    io_entity_type = lo_plan iv_name = 'Version'   iv_field = 'VERSION' ).
    string_property( io_entity_type = lo_plan iv_name = 'Doc'       iv_field = 'DOC' ).
    string_property( io_entity_type = lo_plan iv_name = 'CreatedBy' iv_field = 'CREATED_BY' iv_length = 12 ).
    string_property( io_entity_type = lo_plan iv_name = 'CreatedAt' iv_field = 'CREATED_AT' iv_length = 14 ).
    string_property( io_entity_type = lo_plan iv_name = 'ChangedBy' iv_field = 'CHANGED_BY' iv_length = 12 ).
    string_property( io_entity_type = lo_plan iv_name = 'ChangedAt' iv_field = 'CHANGED_AT' iv_length = 14 ).
    lo_plan->bind_structure( iv_structure_name = 'ZCL_CARPOOL_MPC=>TS_PLAN' ).
    lo_plan->create_entity_set( 'PlanSet' ).

    lo_person = model->create_entity_type( iv_entity_type_name = 'Person' iv_def_entity_set = abap_false ).
    string_property( io_entity_type = lo_person iv_name = 'PlanId'   iv_field = 'PLAN_ID'   iv_length = 20 iv_key = abap_true ).
    string_property( io_entity_type = lo_person iv_name = 'PersonId' iv_field = 'PERSON_ID' iv_length = 20 iv_key = abap_true ).
    int_property(    io_entity_type = lo_person iv_name = 'Pos'      iv_field = 'POS' ).
    string_property( io_entity_type = lo_person iv_name = 'Name'     iv_field = 'NAME'      iv_length = 80 ).
    string_property( io_entity_type = lo_person iv_name = 'Car'      iv_field = 'CAR'       iv_length = 1 ).
    int_property(    io_entity_type = lo_person iv_name = 'Seats'    iv_field = 'SEATS' ).
    string_property( io_entity_type = lo_person iv_name = 'Leg1'     iv_field = 'LEG1'      iv_length = 1 ).
    string_property( io_entity_type = lo_person iv_name = 'Leg2'     iv_field = 'LEG2'      iv_length = 1 ).
    string_property( io_entity_type = lo_person iv_name = 'Team'     iv_field = 'TEAM'      iv_length = 40 ).
    string_property( io_entity_type = lo_person iv_name = 'Lang'     iv_field = 'LANG'      iv_length = 2 ).
    string_property( io_entity_type = lo_person iv_name = 'Note'     iv_field = 'NOTE'      iv_length = 60 ).
    lo_person->bind_structure( iv_structure_name = 'ZCL_CARPOOL_MPC=>TS_PERSON' ).
    lo_person->create_entity_set( 'PersonSet' ).

    " Plan 1 : n Person, joined by PlanId
    lo_assoc = model->create_association(
      iv_association_name = 'PlanPerson'
      iv_left_type        = 'Plan'
      iv_right_type       = 'Person'
      iv_left_card        = /iwbep/if_mgw_med_odata_types=>gcs_cardinality-cardinality_1_1
      iv_right_card       = /iwbep/if_mgw_med_odata_types=>gcs_cardinality-cardinality_0_n
      iv_def_assoc_set    = abap_false ).
    lo_assoc->create_ref_constraint( )->add_property( iv_principal_property = 'PlanId' iv_dependent_property = 'PlanId' ).
    model->create_association_set(
      iv_association_set_name  = 'PlanPersonSet'
      iv_left_entity_set_name  = 'PlanSet'
      iv_right_entity_set_name = 'PersonSet'
      iv_association_name      = 'PlanPerson' ).
    " PERSONS = component of the deep structure the save request is read into (see ZCL_CARPOOL_DPC)
    lo_plan->create_navigation_property(
      iv_property_name    = 'Persons'
      iv_abap_fieldname   = 'PERSONS'
      iv_association_name = 'PlanPerson' ).
  ENDMETHOD.


  METHOD string_property.
    DATA(lo_property) = io_entity_type->create_property( iv_property_name = iv_name iv_abap_fieldname = iv_field ).
    lo_property->set_type_edm_string( ).
    IF iv_length > 0.
      lo_property->set_maxlength( iv_max_length = iv_length ).
    ENDIF.
    IF iv_key = abap_true.
      lo_property->set_is_key( ).
    ELSE.
      lo_property->set_nullable( abap_true ).
    ENDIF.
  ENDMETHOD.


  METHOD int_property.
    DATA(lo_property) = io_entity_type->create_property( iv_property_name = iv_name iv_abap_fieldname = iv_field ).
    lo_property->set_type_edm_int32( ).
    lo_property->set_nullable( abap_true ).
  ENDMETHOD.
ENDCLASS.
