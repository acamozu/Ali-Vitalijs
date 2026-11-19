CLASS zcl_agenda_mpc DEFINITION
  PUBLIC
  INHERITING FROM /iwbep/cl_mgw_push_abs_model
  CREATE PUBLIC .

  " Model of the OData service ZAGENDA_SRV (live agenda of an event), written by hand (no SEGW project).
  "   Event  one row of ZAGENDA_EVENT
  "   Item   one row of ZAGENDA_ITEM; Event -> Items (navigation)

  PUBLIC SECTION.

    TYPES:
      BEGIN OF ts_event,
        event_id   TYPE c LENGTH 20,
        title      TYPE c LENGTH 80,
        company    TYPE c LENGTH 80,
        event_date TYPE c LENGTH 10,   " YYYY-MM-DD
        tz         TYPE c LENGTH 6,    " UTC offset of the times, +01:00
        venue      TYPE c LENGTH 80,
        city       TYPE c LENGTH 40,
        address    TYPE c LENGTH 120,
        public_url TYPE c LENGTH 255,  " address in the QR code; empty = the address of the app
        changed_by TYPE c LENGTH 12,
        changed_at TYPE c LENGTH 14,   " UTC, YYYYMMDDHHMMSS
      END OF ts_event,
      tt_event TYPE STANDARD TABLE OF ts_event WITH DEFAULT KEY,
      BEGIN OF ts_item,
        event_id    TYPE c LENGTH 20,
        pos         TYPE i,
        icon        TYPE c LENGTH 10,
        time_from   TYPE c LENGTH 5,   " HH:MM
        time_to     TYPE c LENGTH 5,   " HH:MM; empty = until the next item starts
        item_type   TYPE c LENGTH 10,  " session | break | social
        section_de  TYPE c LENGTH 40,  " filled on the first item of a part of the day
        section_en  TYPE c LENGTH 40,
        title_de    TYPE c LENGTH 120,
        title_en    TYPE c LENGTH 120,
        subtitle_de TYPE c LENGTH 120,
        subtitle_en TYPE c LENGTH 120,
        speaker     TYPE c LENGTH 60,
        location    TYPE c LENGTH 120,
      END OF ts_item,
      tt_item TYPE STANDARD TABLE OF ts_item WITH DEFAULT KEY.

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
                iv_key         TYPE abap_bool DEFAULT abap_false
      RAISING   /iwbep/cx_mgw_med_exception.
ENDCLASS.



CLASS zcl_agenda_mpc IMPLEMENTATION.


  METHOD define.
    DATA: lo_event TYPE REF TO /iwbep/if_mgw_odata_entity_typ,
          lo_item  TYPE REF TO /iwbep/if_mgw_odata_entity_typ,
          lo_assoc TYPE REF TO /iwbep/if_mgw_odata_assoc.

    model->set_schema_namespace( 'ZAGENDA_SRV' ).

    lo_event = model->create_entity_type( iv_entity_type_name = 'Event' iv_def_entity_set = abap_false ).
    string_property( io_entity_type = lo_event iv_name = 'EventId'   iv_field = 'EVENT_ID'   iv_length = 20 iv_key = abap_true ).
    string_property( io_entity_type = lo_event iv_name = 'Title'     iv_field = 'TITLE'      iv_length = 80 ).
    string_property( io_entity_type = lo_event iv_name = 'Company'   iv_field = 'COMPANY'    iv_length = 80 ).
    string_property( io_entity_type = lo_event iv_name = 'EventDate' iv_field = 'EVENT_DATE' iv_length = 10 ).
    string_property( io_entity_type = lo_event iv_name = 'Tz'        iv_field = 'TZ'         iv_length = 6 ).
    string_property( io_entity_type = lo_event iv_name = 'Venue'     iv_field = 'VENUE'      iv_length = 80 ).
    string_property( io_entity_type = lo_event iv_name = 'City'      iv_field = 'CITY'       iv_length = 40 ).
    string_property( io_entity_type = lo_event iv_name = 'Address'   iv_field = 'ADDRESS'    iv_length = 120 ).
    string_property( io_entity_type = lo_event iv_name = 'PublicUrl' iv_field = 'PUBLIC_URL' iv_length = 255 ).
    string_property( io_entity_type = lo_event iv_name = 'ChangedBy' iv_field = 'CHANGED_BY' iv_length = 12 ).
    string_property( io_entity_type = lo_event iv_name = 'ChangedAt' iv_field = 'CHANGED_AT' iv_length = 14 ).
    lo_event->bind_structure( iv_structure_name = 'ZCL_AGENDA_MPC=>TS_EVENT' ).
    lo_event->create_entity_set( 'EventSet' ).

    lo_item = model->create_entity_type( iv_entity_type_name = 'Item' iv_def_entity_set = abap_false ).
    string_property( io_entity_type = lo_item iv_name = 'EventId'    iv_field = 'EVENT_ID'    iv_length = 20 iv_key = abap_true ).
    int_property(    io_entity_type = lo_item iv_name = 'Pos'        iv_field = 'POS'         iv_key = abap_true ).
    string_property( io_entity_type = lo_item iv_name = 'Icon'       iv_field = 'ICON'        iv_length = 10 ).
    string_property( io_entity_type = lo_item iv_name = 'TimeFrom'   iv_field = 'TIME_FROM'   iv_length = 5 ).
    string_property( io_entity_type = lo_item iv_name = 'TimeTo'     iv_field = 'TIME_TO'     iv_length = 5 ).
    string_property( io_entity_type = lo_item iv_name = 'Type'       iv_field = 'ITEM_TYPE'   iv_length = 10 ).
    string_property( io_entity_type = lo_item iv_name = 'SectionDe'  iv_field = 'SECTION_DE'  iv_length = 40 ).
    string_property( io_entity_type = lo_item iv_name = 'SectionEn'  iv_field = 'SECTION_EN'  iv_length = 40 ).
    string_property( io_entity_type = lo_item iv_name = 'TitleDe'    iv_field = 'TITLE_DE'    iv_length = 120 ).
    string_property( io_entity_type = lo_item iv_name = 'TitleEn'    iv_field = 'TITLE_EN'    iv_length = 120 ).
    string_property( io_entity_type = lo_item iv_name = 'SubtitleDe' iv_field = 'SUBTITLE_DE' iv_length = 120 ).
    string_property( io_entity_type = lo_item iv_name = 'SubtitleEn' iv_field = 'SUBTITLE_EN' iv_length = 120 ).
    string_property( io_entity_type = lo_item iv_name = 'Speaker'    iv_field = 'SPEAKER'     iv_length = 60 ).
    string_property( io_entity_type = lo_item iv_name = 'Location'   iv_field = 'LOCATION'    iv_length = 120 ).
    lo_item->bind_structure( iv_structure_name = 'ZCL_AGENDA_MPC=>TS_ITEM' ).
    lo_item->create_entity_set( 'ItemSet' ).

    " Event 1 : n Item, joined by EventId
    lo_assoc = model->create_association(
      iv_association_name = 'EventItem'
      iv_left_type        = 'Event'
      iv_right_type       = 'Item'
      iv_left_card        = /iwbep/if_mgw_med_odata_types=>gcs_cardinality-cardinality_1_1
      iv_right_card       = /iwbep/if_mgw_med_odata_types=>gcs_cardinality-cardinality_0_n
      iv_def_assoc_set    = abap_false ).
    lo_assoc->create_ref_constraint( )->add_property( iv_principal_property = 'EventId' iv_dependent_property = 'EventId' ).
    model->create_association_set(
      iv_association_set_name  = 'EventItemSet'
      iv_left_entity_set_name  = 'EventSet'
      iv_right_entity_set_name = 'ItemSet'
      iv_association_name      = 'EventItem' ).
    lo_event->create_navigation_property(
      iv_property_name    = 'Items'
      iv_abap_fieldname   = 'ITEMS'
      iv_association_name = 'EventItem' ).
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
    IF iv_key = abap_true.
      lo_property->set_is_key( ).
    ELSE.
      lo_property->set_nullable( abap_true ).
    ENDIF.
  ENDMETHOD.
ENDCLASS.
